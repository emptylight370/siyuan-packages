# 构建

## 单包本地构建

包名取 `package.json` 的 `name`（当前 `sy-format-helper`，与目录名一致）。三种等价入口：

```bash
pnpm --filter sy-format-helper build                      # 根目录，按包名
pnpm --filter ./packages/plugin/sy-format-helper build    # 根目录，按目录
cd packages/plugin/sy-format-helper && pnpm build         # 包目录内
```

产物位置按模式区分。构建实现分两类：esbuild 包走 `scripts/build-plugin.ts`（包内脚本只做转发），vite 包的 `vite.config.ts` 转发到 `scripts/vite-plugin-config.ts` 的 `createPluginViteConfig()`（公共编排，包内只传 `import.meta.dirname` 与 `deps`——scripts/ 解析不到包内 devDependencies，vite 辅助与插件实例必须由包内传入）；两类构建的元数据合成统一由 `scripts/plugin-meta.ts` 的 `resolvePluginMeta()` 提供，`plugin.json` 一律是产物而非源文件：

| 模式              | 命令                                                               | 产物                                                 |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| production        | `build`（即 `node ../../../scripts/build-plugin.ts --production`） | `<pkg>/dist/` 与 `<pkg>/package.zip`                 |
| development 单次  | `pnpm --filter <pkg> exec node ../../../scripts/build-plugin.ts`   | 包根 `index.js`、`index.css`、`i18n/`、`plugin.json` |
| development watch | `dev`（即 `node ../../../scripts/build-plugin.ts --watch`）        | 同上，持续重建并阻塞终端                             |

- production 先清空 `dist/` 与旧 `package.zip`，再合并元数据、校验必填字段与资源引用、最后打 zip，任一步失败即中断
- development 输出到包根，是为了能直接把 `packages/<type>/<pkg>` 软链或复制到思源的 `data/plugins` 调试；这些产物全部被 `.gitignore` 忽略
- 本地构建不需要 `TAG_VERSION`，想模拟发布前校验用：`$env:TAG_VERSION = "0.7.2"; pnpm --filter <pkg> build; Remove-Item Env:TAG_VERSION`（PowerShell）

## 构建作用域

构建脚本本身只构建**一个**包（包目录由 `process.cwd()` 决定），「全部包」来自 pnpm 的 `-r` 递归：

| 执行位置 | 命令                                     | 范围                                          |
| -------- | ---------------------------------------- | --------------------------------------------- |
| 包目录   | `pnpm build`                             | 仅当前包                                      |
| 任意位置 | `pnpm --filter <pkg> build`              | 仅该包                                        |
| 任意位置 | `pnpm -r build`                          | 全部包，**与 cwd 无关**（子包内执行同样如此） |
| 根目录   | `pnpm build`（根脚本为 `pnpm -r build`） | 全部包                                        |

`-r` 的三个默认行为：排除根项目（否则根 `build` 脚本会自调用成死循环）、fail-fast（第一个包失败即停止，需要全部跑完则加 `--no-bail`）、跳过没有 `build` 脚本的包。因此包内 `scripts.build` 不能写成 `pnpm -r build`，必须直接调用构建脚本。CI 发布固定用 `pnpm --filter <pkg> build`，只构建目标包。

## 产物目录随模式变化

production 写 `dist/`，development 写**包根**（`index.js`、`index.css`、`i18n/`、`plugin.json` 都是产物，已被 `.gitignore` 忽略）。这是为了让包目录能直接软链成思源插件目录。

## 构建实现

`scripts/build-plugin.ts` 是**所有 esbuild 包共用的构建实现**，必须在 `packages/<type>/<pkg>` 目录下运行：它以 `process.cwd()` 定位包目录、以 `bazaar.json` 为标志向上查找仓库根，目录结构不匹配时直接报错退出。

内部用 esbuild JS API，不是 webpack：`bundle: true`、`format: 'cjs'`、`external: ['siyuan', '../plugins/*']`、`target` 从包内 `tsconfig.json` 沿 `extends` 链解析（当前基线 `ES2022`）、production 时 `minify` 并把 `LICENSE` 包成 `/*! ... */` 块注释注入 **JS 与 CSS 两个产物**（与官方 plugin-sample 产物一致；裸文本注入会使产物成为非法 JS，CSS 也会缺许可证声明）。SCSS 由自定义 plugin 用 `sass.compileAsync` 转成 CSS 后以 `loader: 'css'` 交回 esbuild，自动产出与 `outfile` 同名的 `.css`。静态资源（`icon.png`、`preview.png`、`README*.md`）用 `fs.copyFile`，`src/i18n/` 存在时才复制，`meta.json` 声明的 `publish.resources`（目录条目整树、文件条目单文件；字体包的 `fonts/` 走这条路径）复制进输出目录，dev 模式下源目标相同则跳过，最后由 `jszip` 把 `dist/` 扁平化打成 `package.zip`。

构建流程顺序：先以**包目录**为资产基准 `resolvePluginMeta`（取得 `publish.resources` 并校验包内资源存在）→ 复制资源 → 以输出目录 `assertAssets` 复验 → 写 `plugin.json` → esbuild → 打 zip。`external` 里的 `'../plugins/*'` 让 CSS 中引用思源插件挂载路径的 `url()`（如 `loadPetals` 注入样式里 `../plugins/<pkg>/fonts/*.woff` 的字体）保持原样输出、不在构建期解析；**不能用 `'../*'`**——该通配会使 esbuild 0.28 静默丢弃整个 CSS 产物（实测）。

构建依赖（`esbuild`、`sass`、`jszip`）仍由**各包自己声明**，脚本通过 `createRequire`（基准指向包内 `package.json`）解析，因此不同包可以使用不同版本；依赖缺失时按「当前包没有安装 X」明确报错，而不是抛出模块解析堆栈。
