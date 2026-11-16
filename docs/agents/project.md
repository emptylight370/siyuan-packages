# 项目结构与约定

## 目录与命名约定

`packages/<type>/<pkg>/`，目前只有 `type = plugin`。**包目录名同时是插件名、构建产物元数据的 `name`、目标发布仓库名**，改名会同时影响集市、发布仓库与构建派生字段。

另有 `packages/lib/<pkg>/` 存放**内部共享 lib**：`sy-api`（思源 API 封装 + 思源基础全局类型，合并自 vite-vue 模板 API 与 format-helper 业务 API，重名函数以模板版为准）与 `sy-vite-component`（思源风格基础控件，控件 `.vue` 平铺在 `src/`）。lib 不发布集市，无 `meta.json` / `cliff.toml`，以 `workspace:*` 声明并**源码级打进插件产物**（无需 build/clean 脚本，`pnpm -r` 自动跳过）；changelog 任务只需空占位。lib 的 ambient 类型（`IRes*` 返回类型 + `siyuan.d.ts` 基础全局类型）经 `src/index.ts` 顶部的 triple-slash 引用进入消费方编译程序——不用 `import type {}`（对全局脚本式 .d.ts 报 TS2306）。各插件包 `src/types/index.d.ts` 仅保留自己的 `Window` 扩展，用 `/// <reference path="../../../../lib/sy-api/src/types/siyuan.d.ts" />` 引入基础类型。lib 不做独立 tsc 检查，由消费方工程覆盖。新增控件：`src/` 下新建 `SyXxx.vue`（思源 `b3-*` 样式类、`<script setup>` 编译宏、v-model 用 `modelValue`/`update:modelValue` 惯例）→ `index.ts` 追加导出 → 消费方 `import { SyXxx } from 'sy-vite-component'`；新依赖才改 package.json。

## 工具链分层

- **mise** 管运行时与 CLI：`node`、`pnpm`、`prettier`、`git-cliff`、`lefthook`。根 `mise.toml` 用 monorepo 模式（`monorepo_root = true`、`config_roots = ["packages/plugin/*", "packages/lib/*"]`），各包的 pnpm scripts 与 `.mise/tasks/` 因此都出现在根目录的 `mise tasks --all` 里；node 脚本导入由根 `mise.toml` 的 `[settings] task.auto_infer = ["node"]` 启用。该特性在 mise 文档中标注为 experimental，但实测（当前版本）`experimental = false` 时导入照常工作、不报错，CI 的 mise-action 默认值下无需额外开关。
- **根 `package.json`** 只放 lint 工具链（oxlint、typescript）、跨包 CLI（rimraf）、类型包（@types/\*）与构建脚本依赖（tsconfck——`scripts/vite-plugin-config.ts` 直接 import），脚本是 workspace 级聚合。
- **包内 `package.json`** 只放构建链（vite、vite-plugin-static-copy、vite-plugin-zip-pack、vite-tsconfig-paths、fast-glob、minimist、sass、rimraf）与 `siyuan` 类型；有 `.vue` 源码的包加 `vue` + `@vitejs/plugin-vue`；`prettier` 不装（mise 提供，避免双版本漂移）。
- 包内**不要**放 `lefthook.yml`、`.prettierrc`、`.gitignore`、`.oxlintrc.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`——这些只认根级，子目录里的不生效。
- 包内 `.mise/tasks/` 会被 mise 识别为任务（无需包内 `mise.toml`）；monorepo 模式下根目录也能看到子包任务，用 `mise run //packages/plugin/<pkg>:<task>` 调用（包目录内裸名 `mise run <task>` 与 `mise -C <pkgDir> run <task>` 均等价）。当前有 `changelog` 与 `release` 两个任务。

## 忽略规则的设计意图

全部包统一走 vite 工厂构建，产物只落在包内 `dist/`（全局已忽略），`plugin.json` 与 `i18n/` 不再出现在包根，根 `.gitignore` 不再需要针对产物的特殊规则。将来若有包需要把构建产物同名文件（如 `index.js` / `index.css`）作为源码提交，需在 `.gitignore` 单独 `!` 放行，并同步在 `.prettierignore` 加 `!`（prettier 也读 `.gitignore`）。

prettier 的 ignore 文件只在**当前工作目录**查找、不向上搜索，因此格式化统一走根 `pnpm format`（`prettier -w .`）；若某包将来要自定义格式化脚本，必须显式列出路径（如 `prettier -w src README*.md`），不能写 `prettier -w .`，否则在包目录下会去格式化 `dist/`。
