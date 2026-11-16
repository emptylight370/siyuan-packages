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
