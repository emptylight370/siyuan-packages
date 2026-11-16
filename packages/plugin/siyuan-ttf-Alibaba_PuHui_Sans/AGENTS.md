# siyuan-ttf-Alibaba_PuHui_Sans

思源字体插件「阿里巴巴普惠体」（`siyuan-ttf-Alibaba_PuHui_Sans`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准；`siyuan-ttf-Noto_Sans` 与本包同构。

## 常用命令

| 命令                                                                  | 说明                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm --filter siyuan-ttf-Alibaba_PuHui_Sans build`                   | 生产构建，产出 `dist/` 与 `package.zip`（字体约 24 MB）                  |
| `pnpm --filter siyuan-ttf-Alibaba_PuHui_Sans dev`                     | vite watch，构建到包内 `dist/`（不压缩），调试走根 `deploy` 任务         |
| `mise run deploy -- -package siyuan-ttf-Alibaba_PuHui_Sans`           | 构建并把 `dist/` 镜像同步到 `data/plugins/siyuan-ttf-Alibaba_PuHui_Sans` |
| `mise -C packages/plugin/siyuan-ttf-Alibaba_PuHui_Sans run changelog` | 生成 `changelog.md`（追加 `changelog.old.md` 历史存档）                  |

## 架构

纯字体包：`src/index.ts` 只做 `document.fonts.load` 预加载，全部功能由 `src/style.scss` 的 `@font-face` + `--b3-font-family-default` 字体栈声明承担。构建栈是 **Vite**（包内 `vite.config.ts` 转发根 `scripts/vite-plugin-config.ts` 工厂）。

## 样式注入机制（关键约定）

1. 样式**不能**在 `onload` 里手动 fetch / snippetCSS 注入：以 `snippetCSS` 为前缀注入的样式会被思源代码片段加载逻辑移除，导致启动时样式短暂出现后被删除。
2. 正确路径：`index.css` 随插件包由 `/api/petal/loadPetals` 返回，前端 `insertPluginCSS` 插入为 `pluginsStyle` 元素，不被代码片段清理影响；导出 PDF/HTML 时也经 `getPluginStyle` 一并带上。
3. 卸载清理由前端在 `destroyPlugin` 中按 `pluginsStyle${name}` 移除，`onunload` 不需要手动处理。

## 字体资源

- `fonts/*.woff` 经 `meta.json` 的 `publish.resources: ["fonts/"]` 在构建时整树复制进 `dist/fonts/`（根构建脚本支持）。
- `src/style.scss` 中 `url('../plugins/siyuan-ttf-.../fonts/...')` 是**运行时相对路径**（样式注入后相对页面解析，指向思源插件挂载目录）。vite 无法在构建期解析，会输出「didn't resolve at build time」警告并原样保留 URL——**预期行为，不要改成包内相对路径**。
- 字体有独立授权（非 MIT），见 `LICENSE` 顶部说明；`fonts/` 内不要混入非字体文件。

## 构建要点

- `package.json` 的 `build` / `dev` 都是 `vite build`（watch 加 `--watch`），构建编排全部在根 `scripts/vite-plugin-config.ts` 工厂
- 构建流程：`viteStaticCopy` 复制 README、icon、preview 与 `fonts/`（经 `publish.resources`）→ 合成 `plugin.json` → 生产构建注入 LICENSE banner 并打 `package.zip`
- 产物为 `dist/index.css` 与 `dist/index.js`（CJS，`module.exports.default` 为插件类）

## changelog

输出文件沿用上游命名 `changelog.md`（非 monorepo 缺省的 `whatschange.md`），历史存档为 `changelog.old.md`，由包内 `mise.toml` 的 `CHANGELOG_LEGACY` 声明追加，**不要删除或重命名**。
