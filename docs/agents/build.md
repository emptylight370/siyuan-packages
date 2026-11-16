# 构建

## 单包本地构建

包名取 `package.json` 的 `name`（与目录名一致）。三种等价入口：

```bash
pnpm --filter sy-format-helper build                      # 根目录，按包名
pnpm --filter ./packages/plugin/sy-format-helper build    # 根目录，按目录
cd packages/plugin/sy-format-helper && pnpm build         # 包目录内
```

全部包统一走 **vite** 构建：包内 `vite.config.ts` 转发到 `scripts/vite-plugin-config.ts` 的 `createPluginViteConfig()`（公共编排，包内只传 `import.meta.dirname` 与 `deps`——scripts/ 解析不到包内 devDependencies，vite 辅助与插件实例必须由包内传入；有 `.vue` 源码的包额外传 `vue`）。元数据合成统一由 `scripts/plugin-meta.ts` 的 `resolvePluginMeta()` 提供，`plugin.json` 一律是产物而非源文件：

| 模式              | 命令                             | 产物                                               |
| ----------------- | -------------------------------- | -------------------------------------------------- |
| production        | `build`（即 `vite build`）       | `<pkg>/dist/` 与 `<pkg>/package.zip`               |
| development watch | `dev`（即 `vite build --watch`） | 同 `dist/`（不压缩、不打 zip），持续重建并阻塞终端 |

- watch 与 production **一律构建到包内 `dist/`**，没有直写思源工作空间的逻辑（`VITE_SIYUAN_WORKSPACE_PATH` / livereload 已移除）；调试统一走根 `deploy` 任务把 `dist/` 镜像同步到工作空间，或手动把 `dist` 内容复制/软链为 `data/plugins/<pkg>`
- production 清空 `dist/`（emptyOutDir），构建完成后由 zipPack 把 `dist/` 扁平打成 `package.zip`
- 本地构建不需要 `TAG_VERSION`，想模拟发布前校验用：`$env:TAG_VERSION = "0.7.3"; pnpm --filter <pkg> build; Remove-Item Env:TAG_VERSION`（PowerShell）

## 构建作用域

单次构建只处理**一个**包（包目录由 `vite.config.ts` 所在目录决定），「全部包」来自 pnpm 的 `-r` 递归：

| 执行位置 | 命令                                     | 范围                                          |
| -------- | ---------------------------------------- | --------------------------------------------- |
| 包目录   | `pnpm build`                             | 仅当前包                                      |
| 任意位置 | `pnpm --filter <pkg> build`              | 仅该包                                        |
| 任意位置 | `pnpm -r build`                          | 全部包，**与 cwd 无关**（子包内执行同样如此） |
| 根目录   | `pnpm build`（根脚本为 `pnpm -r build`） | 全部包                                        |

`-r` 的三个默认行为：排除根项目（否则根 `build` 脚本会自调用成死循环）、fail-fast（第一个包失败即停止，需要全部跑完则加 `--no-bail`）、跳过没有 `build` 脚本的包。CI 发布固定用 `pnpm --filter <pkg> build`，只构建目标包。

## 构建实现

`scripts/vite-plugin-config.ts` 的 `createPluginViteConfig()` 是**所有包共用的构建编排**，包内 `vite.config.ts` 只保留 `pkgDir` 与 `deps`（vite 辅助与插件实例——scripts/ 解析不到包内 devDependencies）。

编排内容与关键决策：

- **元数据**：配置阶段调 `resolvePluginMeta({ pkgDir })`（包目录级资产校验 + `TAG_VERSION` 一致性），自定义 rollup 插件 `emit-plugin-json` 在 `generateBundle` 把合成结果 emit 为 `plugin.json`
- **语法目标**：`build.target` 从包内 `tsconfig.json` 沿 `extends` 链解析 `compilerOptions.target`（当前基线 `ES2022`），与 tsconfig 单一来源、不漂移
- **静态资源**：`viteStaticCopy` 负责 `README*.md`、`icon.png` / `preview.png`（按包根存在性过滤）、`src/i18n/**` → `i18n/`（`stripBase: 2`，目录不存在时跳过——字体包没有 i18n，viteStaticCopy 对空匹配 glob 会直接报错）、`publish.resources`（目录条目保留目录名整树复制，字体包的 `fonts/` 走这条路径）
- **LICENSE banner**：生产构建由自定义插件 `license-banner`（`enforce: 'post'`，保证排在产出 CSS asset 的 `vite:css-post` 之后）给 JS chunk 与 CSS asset 前置 `/*! ... */` 块注释（与官方 plugin-sample 产物一致；裸文本注入会使产物成为非法 JS）
- **zip**：生产构建由 `vite-plugin-zip-pack` 把 `dist/` 扁平打成 `package.zip`（zip 根无顶层目录）
- **external**：`siyuan`、`process` 不参与打包

CSS 中引用**思源插件挂载路径**的 `url()`（如 `loadPetals` 注入样式里 `../plugins/<pkg>/fonts/*.woff` 的字体）vite 无法在构建期解析，构建输出「didn't resolve at build time, will remain unchanged to be resolved at runtime」警告并原样保留 URL——这是预期行为，不是错误。

构建依赖（`vite`、`vite-plugin-static-copy`、`vite-plugin-zip-pack`、`fast-glob`、`minimist`、`sass`）由**各包自己声明**（catalog 统一版本）。

## 补充文件进 package.zip

除标准产物（`index.js` / `index.css` / `plugin.json` / `icon` / `preview` / `README*` / `i18n/` / `publish.resources`）之外，某些场景需要把额外文件带进压缩包。按「文件从哪来、运行时怎么取」选择手段：

| 场景                        | 典型例子                                                             | 手段                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 被源码 import 引用的资产    | 图片、字体、`.vue` 内联资源                                          | **import / `new URL('./x', import.meta.url)`**：vite 自动 emit 到 `dist/assets/`（带 hash）并重写引用路径，这是 vite 最地道的资产方式            |
| 固定约定路径的静态文件      | 运行时按路径 fetch 的数据/字典/预设 JSON、worker.js、wasm、皮肤文件  | **包根 `public/` 目录**：vite 原生 `publicDir` 机制，构建时原样整树复制到 `dist/` 根（相对结构保留），零配置——已实测可用                         |
| 构建期生成的产物            | 动态生成的清单/JSON、编译出的 wasm                                   | **包内自定义 rollup 插件**：`generateBundle` 里 `this.emitFile()`（emit 即进 dist → zip），或 `closeBundle` 直接写盘；可复用的逻辑可下沉到根工厂 |
| 需要集市/思源感知的发布资源 | 字体包的 `fonts/`（随包分发且声明给思源）                            | **`meta.json` 的 `publish.resources`**（工厂已实现，目录条目保留目录名整树复制）                                                                 |
| 思源 data 语义文件          | kernel 读取的插件数据（官方样例的 `publish.data: ["readonlyText"]`） | **`meta.json` 的 `publish.data`**——⚠️ 工厂**尚未实现** data 目录复制，接入第一个使用的包时需先补实现                                             |
| 内核产物                    | `kernel.js`（backends 插件）                                         | 未支持：当前工厂不复制内核产物，接入第一个含内核的包时一并处理（`kernels` 字段校验已就绪）                                                       |

选型原则：文件「被代码用」走 import emit，「按约定路径取」走 `public/`，「集市/思源要感知」走 `publish.*` 声明，「构建时才存在」写 emit 插件。

注意事项：

1. `public/` 内容**原样复制**（不压缩、不改名、不经构建管线），且 `vite build --watch` 不会因 `public/` 变化触发重建——需要热跟随则把 `'./public/**'` 加进包 `vite.config.ts` 的 `watchFiles` 选项（工厂已支持透传）
2. `public/` 文件不出现在 `plugin.json` 中，集市/思源对其无感知，仅运行时按插件挂载路径访问（与字体包 CSS 的 `../plugins/<pkg>/fonts/` 同理）
3. 额外文件会增大 `package.zip` 体积，集市对 zip 无硬性体积限制（icon ≤ 64 KiB / preview ≤ 512 KiB 是仅有的体积约束），但避免塞无用大文件
4. `emptyOutDir` 清空发生在复制之前，`public/` 文件不会在 watch 重建中丢失
