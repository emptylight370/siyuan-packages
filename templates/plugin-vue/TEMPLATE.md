# plugin-vue 模板（预适配版）

> 本文件是模板自身的使用说明，**复制模板后不随包带走**；包内的 `README.md` / `README.zh-CN.md` 是集市说明占位。

从官方 `siyuan-note/plugin-sample-vite-vue` 预适配 monorepo 构建栈的插件模板。原始模板的逐段解析见 [docs/plugin-sample-vite-vue.md](../../docs/plugin-sample-vite-vue.md)（回查用）。

## 来源与预适配内容

- 基线：官方 vite-vue 模板，经 `plugin-vscodelite-edit` / `siyuan-ignoreeditor` 两个改造包提取的共通骨架
- 已完成 `docs/agents/new-package.md`「共通改造」的机械部分：`meta.json` 拆分、根 vite 工厂转发、`cliff.toml`、`mise.toml` changelog 占位、tsconfig 继承 base、package.json 精简（catalog + workspace lib）、i18n 目录
- 已删除官方模板的：`plugin.json`（产物）、`api.ts`（改用 `sy-api` lib）、`release.js` / `eslint` / `tsconfig.node.json` / `.env.example`、`.git` / `.github` / `.vscode`

## 使用步骤（新建包时）

1. 复制本目录到 `packages/plugin/<新包名>/`（目录名同时是插件名、发布仓库名，起名前想清楚），删除本文件与占位 `icon.png` / `preview.png` 的说明见下
2. 改名清单（占位符 / 通用名）：
   - `package.json` 的 `name`
   - `cliff.toml` 的 `tag_pattern` 与 `include_paths`（两处 `__PKG__`）
   - `src/index.ts` 的插件类名（`PluginTemplate`）
   - `src/main.ts` 的挂载 div class（`plugin-template-app`，`App.vue` 全局样式块同名）
   - `src/types/index.d.ts` 的 `Window` 扩展键名（`pluginTemplate`）
   - `src/App.vue`：按新包功能重写示例内容
   - `meta.json`：`displayName` / `description` / `keywords`；`version` 由 pre-commit 自动对齐，保持不动
   - `README.md` / `README.zh-CN.md`：替换为真实集市说明
   - 包内 `AGENTS.md`：标题与 TODO 段
3. 替换占位 `icon.png` / `preview.png`
4. `bazaar.json` **无需改动**（`types.plugin` 是全局模板，包级字段不落 bazaar）
5. 按 `docs/agents/new-package.md` 共通改造第 7 步验证：根 `pnpm install` → `pnpm -r build` → `pnpm lint` → `pnpm exec tsc --noEmit -p packages/plugin/<pkg>/tsconfig.json` → `mise run //packages/plugin/<pkg>:changelog`
6. 首次发布走 `docs/agents/release.md`（stub 仓库 + `mise run tag`）

## 已知限制

- 本目录不在 pnpm workspace / mise `config_roots` 内：依赖不安装、构建/lint 不覆盖，**修改后必须复制到 `packages/plugin/` 下临时验证**（或随某个新包的创建自然验证）
- 根工厂签名、catalog 依赖、vite 大版本升级时需人工复查本模板（无自动漂移检测）；改动历史记录在本文件底部的「修订记录」

## 修订记录

- 2026-11-28：初版，基线取自 `plugin-vscodelite-edit` / `siyuan-ignoreeditor` 改造后共通骨架
