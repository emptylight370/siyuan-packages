# 质量与验证

## lint（oxlint）

lint 已从 ESLint 迁到 **oxlint**，配置在根 `.oxlintrc.json`：

- 由 `npx @oxlint/migrate eslint.config.mjs` 生成后手工修正——migrate 会把 ESLint 的全局规则块转成 `overrides[].files: [null]` 导致解析失败，已把该块的规则合并进顶层 `rules`（含 `prefer-const`、`no-var` 等，以及被 `@typescript-eslint/recommended` 关闭的一批 core 规则）
- 采用**显式规则列表**（82 条）而非类别开关（`categories.correctness` 为 `off`），含 `typescript` 与 `unicorn` 插件；跳过了 2 条 Nursery（`no-undef`、`no-useless-assignment`）与 2 条不支持（`no-dupe-args`、`no-octal`）
- `no-unused-vars` 配置为 `["warn", { "caughtErrors": "none" }]`，catch 参数不检查，与迁移前一致
- oxlint **不做类型检查、不读 tsconfig**；`quotes` / `semi` / `indent` 这类格式规则不存在（规则表共 872 条，搜不到），与 prettier 天然无冲突，`eslint-config-prettier` 已随之删除
- **不要开启 `Style` 类（279 条）**：整体开启会产生 714 个写法偏好告警（如 `prefer-destructuring`），噪音远大于收益
- `lint:fix` = `oxlint --fix`，只应用安全变更；`.eslintcache` 已废弃

**TS 版本约束解除**：移除 `@typescript-eslint` 后，`typescript` 不再被 `>=4.8.4 <6.1.0` 的 peer 锁定（曾实测 TS 7.0 会让 ESLint 崩溃），可升级至 TS 7；类型检查用的 `tsc` 换成 tsgo 后，`tsconfig.node.json` 的 `composite` + `--noEmit` 组合需重新实测。

## TypeScript 配置

根 `tsconfig.base.json` 提供跨包共享的编译选项，各包用 `"extends": "../../../tsconfig.base.json"` 继承，包内只保留差异项（`paths`、`types`、`jsx`、`include` 等）：

| 选项                                                                     | 值                                           | 依据                                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `target` / `lib`                                                         | `ES2022` / `ES2022` + `DOM` + `DOM.Iterable` | 思源桌面端用 latest-2 的 Electron，移动端 webview 最低 Chrome 95；`ES2022` 是安全上限       |
| `module` / `moduleResolution`                                            | `ESNext` / `bundler`                         | 源码都由打包器处理（esbuild / vite），产物格式由构建脚本决定，与 tsconfig 无关              |
| `strict`                                                                 | `true`                                       | 全包启用；涉及 class 属性、`catch` 变量、null 收窄，新增代码不得用包级 `strict: false` 降级 |
| `isolatedModules`                                                        | `true`                                       | 与单文件转译一致，拦住只能靠类型信息完成的写法                                              |
| `skipLibCheck` / `forceConsistentCasingInFileNames`                      | `true`                                       | 前者提速 IDE；后者防 Windows 本地通过、Linux CI 报错                                        |
| `resolveJsonModule` / `esModuleInterop` / `allowSyntheticDefaultImports` | `true`                                       | 支持 `import meta from './meta.json'` 与 CJS 依赖的默认导入                                 |

不进 base 的项：`paths`（各包别名不同）、`types`（vite 包需要 `vite/client`）、`jsx` / `allowJs` / `checkJs`（Vue 工程特有）、`noEmit`（`tsconfig.node.json` 的 `composite` 需要 emit）、`noUnusedLocals` / `noUnusedParameters`（严格度选项）。

esbuild 的产物语法目标在 `scripts/build-plugin.ts` 里从包内 `tsconfig.json` 沿 `extends` 链解析 `compilerOptions.target` 得出（当前基线 `ES2022`），与 tsconfig 单一来源、不会漂移。

类型检查**不在**质量门禁内（`pnpm lint` 只跑 oxlint，不读 tsconfig），需要时手动执行 `pnpm exec tsc --noEmit -p packages/plugin/<pkg>/tsconfig.json`；含 `.vue` 的包需要 `vue-tsc` 才能覆盖 SFC 内部（当前靠 `*.vue` 声明文件绕过了那部分）。根 `pnpm typecheck` 只覆盖 `scripts/*.ts`（构建脚本自身的类型检查）。

## Git hooks

根 `lefthook.yml` 的 `pre-commit` 包含多个 job（完整清单见 [release.md](./release.md)），其中格式化 job：对 `{staged_files}` 按 glob 过滤后执行 `prettier -w`，并带 `stage_fixed: true`（否则格式化结果不会进入本次提交）。glob 覆盖 `ts/tsx/mts/cts/js/jsx/mjs/cjs`、`scss/css/less`、`md`、`json/jsonc/json5`、`yaml/yml`。

`.prettierrc` 的 `endOfLine: "auto"` 是为 Windows（`core.autocrlf=true`，工作区 CRLF）与 CI（LF）共存设置的，不要改回 `lf`。

## 集市结构校验

`pnpm check`（`scripts/check-packages.ts`）校验各发布包的元数据契约，检测项与集市规则来源见 [metadata.md](./metadata.md#元数据字段校验)。
