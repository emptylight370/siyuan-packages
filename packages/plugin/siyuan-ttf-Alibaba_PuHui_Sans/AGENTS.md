# siyuan-ttf-Alibaba_PuHui_Sans

思源字体插件「阿里巴巴普惠体」（`siyuan-ttf-Alibaba_PuHui_Sans`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准；`siyuan-ttf-Noto_Sans` 与本包同构。

## 常用命令

| 命令                                                                  | 说明                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm --filter siyuan-ttf-Alibaba_PuHui_Sans build`                   | 生产构建，产出 `dist/` 与 `package.zip`（字体约 24 MB）                  |
| `pnpm --filter siyuan-ttf-Alibaba_PuHui_Sans dev`                     | esbuild watch，产物写到包根，便于软链到思源插件目录调试                  |
| `mise run deploy -- -package siyuan-ttf-Alibaba_PuHui_Sans`           | 构建并把 `dist/` 镜像同步到 `data/plugins/siyuan-ttf-Alibaba_PuHui_Sans` |
| `mise -C packages/plugin/siyuan-ttf-Alibaba_PuHui_Sans run changelog` | 生成 `changelog.md`（追加 `changelog.old.md` 历史存档）                  |

## 架构

纯字体包：`src/index.ts` 只做 `document.fonts.load` 预加载，全部功能由 `src/style.scss` 的 `@font-face` + `--b3-font-family-default` 字体栈声明承担。构建栈是 **esbuild**（根 `scripts/build-plugin.ts`），包内没有 `vite.config.ts`。

## 样式注入机制（关键约定）

1. 样式**不能**在 `onload` 里手动 fetch / snippetCSS 注入：以 `snippetCSS` 为前缀注入的样式会被思源代码片段加载逻辑移除，导致启动时样式短暂出现后被删除。
2. 正确路径：`index.css` 随插件包由 `/api/petal/loadPetals` 返回，前端 `insertPluginCSS` 插入为 `pluginsStyle` 元素，不被代码片段清理影响；导出 PDF/HTML 时也经 `getPluginStyle` 一并带上。
3. 卸载清理由前端在 `destroyPlugin` 中按 `pluginsStyle${name}` 移除，`onunload` 不需要手动处理。

## 字体资源

- `fonts/*.woff` 经 `meta.json` 的 `publish.resources: ["fonts/"]` 在构建时整树复制进 `dist/fonts/`（根构建脚本支持）。
- `src/style.scss` 中 `url('../plugins/siyuan-ttf-.../fonts/...')` 是**运行时相对路径**（样式注入后相对页面解析，指向思源插件挂载目录），根构建脚本用 `external: ['siyuan', '../plugins/*']` 让 esbuild 不解析它们——**不要改成包内相对路径**。
- 字体有独立授权（非 MIT），见 `LICENSE` 顶部说明；`fonts/` 内不要混入非字体文件。

## 构建要点

- `package.json` 的 `build` / `dev` 转发到根 `scripts/build-plugin.ts`，包内没有构建实现
- 构建流程：`copyAssets`（README、icon、preview、`fonts/`）→ `assertAssets` 复验 dist → 合成 `plugin.json` → esbuild 打包
- 产物为 `dist/index.css` 与 `dist/index.js`（CJS，`module.exports.default` 为插件类）

## changelog

输出文件沿用上游命名 `changelog.md`（非 monorepo 缺省的 `whatschange.md`），历史存档为 `changelog.old.md`，由包内 `mise.toml` 的 `CHANGELOG_LEGACY` 声明追加，**不要删除或重命名**。
