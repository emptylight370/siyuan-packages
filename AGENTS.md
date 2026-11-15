# 思源插件 monorepo

思源（SiYuan）插件 monorepo。每个子包最终都要发布到自己的独立 GitHub 仓库，因为思源集市按「仓库」查找 `tag == version` 的 release 并下载其中的 `package.zip`。

部分包内部有各自的 `AGENTS.md`，只描述该包的架构、命令与隐性约定，改动该包前应先读；跨包规则一律以本文件为准，两者冲突时本文件优先。

## 常用命令

```bash
mise install                      # 安装 node / pnpm / prettier / git-cliff / lefthook
pnpm install                      # 安装根与所有 workspace 包的依赖
pnpm -r build                     # 构建全部包（各包调用根 scripts/build-plugin.mjs）
pnpm --filter sy-format-helper build   # 单包 production 构建，产出 <pkg>/dist 与 <pkg>/package.zip
pnpm --filter sy-format-helper dev     # esbuild watch，产物写到包根，便于软链到思源插件目录调试
pnpm lint                         # oxlint packages/plugin
pnpm lint:fix                     # 同上并自动修复
pnpm format                       # prettier -w .（读根 .prettierrc 与 .prettierignore）
pnpm -r clean                     # 删除各包 dist 与 package.zip
mise run //:build                 # 根脚本也导入为 mise 任务（workspace graph），等价 pnpm -r build
mise run //packages/plugin/sy-format-helper:build   # 单包构建（= pnpm --filter sy-format-helper build）
mise run tag                      # 为各包创建本地发布 tag（已存在或版本未变则跳过）
mise run deploy -- -package <pkg> # 构建单包并把 dist 部署到思源工作空间
```

monorepo 模式 + workspace graph 把根与各包的 `package.json` scripts、子包 `.mise/tasks/` 全部导入为 mise 任务：根与包脚本名为 `node:<pkg>#<script>`（根项目 `node:siyuan-packages#build`），同时有路径式别名 `//packages/plugin/<pkg>:<script>`；两者都从仓库根直接可调用，`mise tasks`（包内）/ `mise tasks --all`（根）查看。

没有测试框架，也没有测试脚本；质量门禁是 `pnpm lint`、`prettier -c .` 与 `pnpm -r build` 三者。

### 单包本地构建

包名取 `package.json` 的 `name`（当前 `sy-format-helper`，与目录名一致）。三种等价入口：

```bash
pnpm --filter sy-format-helper build                      # 根目录，按包名
pnpm --filter ./packages/plugin/sy-format-helper build    # 根目录，按目录
cd packages/plugin/sy-format-helper && pnpm build         # 包目录内
```

产物位置按模式区分。构建实现分两类：esbuild 包走 `scripts/build-plugin.mjs`（包内脚本只做转发），vite 包的 `vite.config.ts` 转发到 `scripts/vite-plugin-config.mjs` 的 `createPluginViteConfig()`（公共编排，包内只传 `import.meta.dirname` 与 `deps`——scripts/ 解析不到包内 devDependencies，vite 辅助与插件实例必须由包内传入）；两类构建的元数据合成统一由 `scripts/plugin-meta.mjs` 的 `resolvePluginMeta()` 提供，`plugin.json` 一律是产物而非源文件：

| 模式              | 命令                                                                | 产物                                                 |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| production        | `build`（即 `node ../../../scripts/build-plugin.mjs --production`） | `<pkg>/dist/` 与 `<pkg>/package.zip`                 |
| development 单次  | `pnpm --filter <pkg> exec node ../../../scripts/build-plugin.mjs`   | 包根 `index.js`、`index.css`、`i18n/`、`plugin.json` |
| development watch | `dev`（即 `node ../../../scripts/build-plugin.mjs --watch`）        | 同上，持续重建并阻塞终端                             |

- production 先清空 `dist/` 与旧 `package.zip`，再合并元数据、校验必填字段与资源引用、最后打 zip，任一步失败即中断
- development 输出到包根，是为了能直接把 `packages/<type>/<pkg>` 软链或复制到思源的 `data/plugins` 调试；这些产物全部被 `.gitignore` 忽略
- 本地构建不需要 `TAG_VERSION`，想模拟发布前校验用：`$env:TAG_VERSION = "0.7.2"; pnpm --filter <pkg> build; Remove-Item Env:TAG_VERSION`（PowerShell）

### 构建作用域

构建脚本本身只构建**一个**包（包目录由 `process.cwd()` 决定），「全部包」来自 pnpm 的 `-r` 递归：

| 执行位置 | 命令                                     | 范围                                          |
| -------- | ---------------------------------------- | --------------------------------------------- |
| 包目录   | `pnpm build`                             | 仅当前包                                      |
| 任意位置 | `pnpm --filter <pkg> build`              | 仅该包                                        |
| 任意位置 | `pnpm -r build`                          | 全部包，**与 cwd 无关**（子包内执行同样如此） |
| 根目录   | `pnpm build`（根脚本为 `pnpm -r build`） | 全部包                                        |

`-r` 的三个默认行为：排除根项目（否则根 `build` 脚本会自调用成死循环）、fail-fast（第一个包失败即停止，需要全部跑完则加 `--no-bail`）、跳过没有 `build` 脚本的包。因此包内 `scripts.build` 不能写成 `pnpm -r build`，必须直接调用构建脚本。CI 发布固定用 `pnpm --filter <pkg> build`，只构建目标包。

发布靠 push tag 触发 CI，不要在本地手动建 release。tag 由根任务统一创建（扫描 `packages/*/*/meta.json`，tag 已存在或版本未变则跳过）：

```bash
mise run tag
git push origin "sy-format-helper@0.7.2"   # 推送 tag 触发 CI 发布
```

仓库配置了 `tag.gpgSign = true`，任务内部用 `git tag -a <tag> -m ''` 创建空消息 annotated tag；不要用裸 `git tag <name>`，它会打开编辑器并失败。

## 架构

### 目录与命名约定

`packages/<type>/<pkg>/`，目前只有 `type = plugin`。**包目录名同时是插件名、构建产物元数据的 `name`、目标发布仓库名**，改名会同时影响集市、发布仓库与构建派生字段。

另有 `packages/lib/<pkg>/` 存放**内部共享 lib**：`sy-vite-api`（源自 vite-vue 模板的思源 API 封装；`sy-format-helper` 的 `src/api.ts` 是另一套业务实现，勿混淆）与 `sy-vite-component`（思源风格基础控件，控件 `.vue` 平铺在 `src/`）。lib 不发布集市，无 `meta.json` / `cliff.toml`，以 `workspace:*` 声明并**源码级打进插件产物**（无需 build/clean 脚本，`pnpm -r` 自动跳过）；changelog 任务只需空占位。lib 的 ambient 类型声明经 `import type {}` 进入消费方编译程序；`IRes*` 等引用的基础类型仍由插件包 `src/types/index.d.ts` 提供，lib 不做独立 tsc 检查，由消费方工程覆盖。新增控件：`src/` 下新建 `SyXxx.vue`（思源 `b3-*` 样式类、`<script setup>` 编译宏、v-model 用 `modelValue`/`update:modelValue` 惯例）→ `index.ts` 追加导出 → 消费方 `import { SyXxx } from 'sy-vite-component'`；新依赖才改 package.json。

### 元数据三层模型（最需要注意的部分）

完整元数据不再以源文件形式存在，而是构建时合成：

| 层   | 文件                                       | 内容                                                                                          |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 模板 | `bazaar.json`                              | `owner` + `types.<type>` 段，放跨包通用字段（author、backends、icon、readme 默认名、funding） |
| 差异 | `packages/<type>/<pkg>/meta.json`          | 仅包独有字段，`version` 是唯一版本来源                                                        |
| 产物 | `<outDir>/<type>.json`（即 `plugin.json`） | 合并结果，进 `package.zip`                                                                    |

`scripts/build-plugin.mjs` 的 `composeMeta()` 负责：`bazaar.types[type]` 与 `meta.json` 深合并（对象递归、数组整体替换）→ `${owner}/${name}/${version}` 占位符替换 → 派生 `name`（目录名）、`url`（`https://github.com/<owner>/<name>`）、`version` → 校验。

规则：`meta.json` **禁止**出现 `name` / `url`（构建期派生，出现即报错）；12 个必填字段缺失即失败；`readme` / `icon` / `preview` / `publish.resources` 必须在产物目录存在；环境变量 `TAG_VERSION` 存在时必须等于 `meta.version`。

产物目录随模式变化：production 写 `dist/`，development 写**包根**（`index.js`、`index.css`、`i18n/`、`plugin.json` 都是产物，已被 `.gitignore` 忽略）。这是为了让包目录能直接软链成思源插件目录。

### 构建实现

`scripts/build-plugin.mjs` 是**所有包共用的唯一构建实现**，必须在 `packages/<type>/<pkg>` 目录下运行：它以 `process.cwd()` 定位包目录、以 `bazaar.json` 为标志向上查找仓库根，目录结构不匹配时直接报错退出。

内部用 esbuild JS API，不是 webpack：`bundle: true`、`format: 'cjs'`、`external: ['siyuan']`、`target: 'es6'`、production 时 `minify` 并把 `LICENSE` 通过 `banner.js` 注入。SCSS 由自定义 plugin 用 `sass.compileAsync` 转成 CSS 后以 `loader: 'css'` 交回 esbuild，自动产出与 `outfile` 同名的 `.css`。静态资源（`icon.png`、`preview.png`、`README*.md`）用 `fs.copyFile`，`src/i18n/` 存在时才复制，最后由 `jszip` 把 `dist/` 扁平化打成 `package.zip`。

构建依赖（`esbuild`、`sass`、`jszip`）仍由**各包自己声明**，脚本通过 `createRequire`（基准指向包内 `package.json`）解析，因此不同包可以使用不同版本；依赖缺失时按「当前包没有安装 X」明确报错，而不是抛出模块解析堆栈。

### 工具链分层

- **mise** 管运行时与 CLI：`node`、`pnpm`、`prettier`、`git-cliff`、`lefthook`。根 `mise.toml` 用 monorepo 模式（`monorepo_root = true`、`config_roots = ["packages/plugin/*", "packages/lib/*"]`），各包的 pnpm scripts 与 `.mise/tasks/` 因此都出现在根目录的 `mise tasks --all` 里；node 脚本导入由根 `mise.toml` 的 `[settings] task.auto_infer = ["node"]` 启用。该特性在 mise 文档中标注为 experimental，但实测（当前版本）`experimental = false` 时导入照常工作、不报错，CI 的 mise-action 默认值下无需额外开关。
- **根 `package.json`** 只放 lint 工具链（oxlint、typescript）、跨包 CLI（rimraf）与类型包（@types/*），脚本是 workspace 级聚合。
- **包内 `package.json`** 只放构建链（esbuild、sass、jszip、rimraf）与 `siyuan` 类型；`prettier` 不装（mise 提供，避免双版本漂移）。
- 包内**不要**放 `lefthook.yml`、`.prettierrc`、`.gitignore`、`.oxlintrc.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`——这些只认根级，子目录里的不生效。

### lint（oxlint）

lint 已从 ESLint 迁到 **oxlint**，配置在根 `.oxlintrc.json`：

- 由 `npx @oxlint/migrate eslint.config.mjs` 生成后手工修正——migrate 会把 ESLint 的全局规则块转成 `overrides[].files: [null]` 导致解析失败，已把该块的规则合并进顶层 `rules`（含 `prefer-const`、`no-var` 等，以及被 `@typescript-eslint/recommended` 关闭的一批 core 规则）
- 采用**显式规则列表**（82 条）而非类别开关（`categories.correctness` 为 `off`），含 `typescript` 与 `unicorn` 插件；跳过了 2 条 Nursery（`no-undef`、`no-useless-assignment`）与 2 条不支持（`no-dupe-args`、`no-octal`）
- `no-unused-vars` 配置为 `["warn", { "caughtErrors": "none" }]`，catch 参数不检查，与迁移前一致
- oxlint **不做类型检查、不读 tsconfig**；`quotes` / `semi` / `indent` 这类格式规则不存在（规则表共 872 条，搜不到），与 prettier 天然无冲突，`eslint-config-prettier` 已随之删除
- **不要开启 `Style` 类（279 条）**：整体开启会产生 714 个写法偏好告警（如 `prefer-destructuring`），噪音远大于收益
- `lint:fix` = `oxlint --fix`，只应用安全变更；`.eslintcache` 已废弃

**TS 版本约束解除**：移除 `@typescript-eslint` 后，`typescript` 不再被 `>=4.8.4 <6.1.0` 的 peer 锁定（曾实测 TS 7.0 会让 ESLint 崩溃），可升级至 TS 7；类型检查用的 `tsc` 换成 tsgo 后，`tsconfig.node.json` 的 `composite` + `--noEmit` 组合需重新实测。

- 包内 `.mise/tasks/` 会被 mise 识别为任务（无需包内 `mise.toml`）；monorepo 模式下根目录也能看到子包任务，用 `mise run //packages/plugin/<pkg>:<task>` 调用（包目录内裸名 `mise run <task>` 与 `mise -C <pkgDir> run <task>` 均等价）。当前有 `changelog` 与 `release` 两个任务。

### TypeScript 配置

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

esbuild 的产物语法目标在 `scripts/build-plugin.mjs` 里单独设为 `chrome95`，与 tsconfig 的 `target` 相互独立。

类型检查**不在**质量门禁内（`pnpm lint` 只跑 oxlint，不读 tsconfig），需要时手动执行 `pnpm exec tsc --noEmit -p packages/plugin/<pkg>/tsconfig.json`；含 `.vue` 的包需要 `vue-tsc` 才能覆盖 SFC 内部（当前靠 `*.vue` 声明文件绕过了那部分）。

### Git hooks

根 `lefthook.yml` 只有 `pre-commit` 一个 job：对 `{staged_files}` 按 glob 过滤后执行 `prettier -w`，并带 `stage_fixed: true`（否则格式化结果不会进入本次提交）。glob 覆盖 `ts/tsx/mts/cts/js/jsx/mjs/cjs`、`scss/css/less`、`md`、`json/jsonc/json5`、`yaml/yml`。

`.prettierrc` 的 `endOfLine: "auto"` 是为 Windows（`core.autocrlf=true`，工作区 CRLF）与 CI（LF）共存设置的，不要改回 `lf`。

### 本地发布任务

包级任务的声明方式分两类。monorepo 模式下 mise 把任务执行目录设为所属包目录，因此从根目录 `mise run //packages/plugin/<pkg>:<task>` 也能正确运行；包目录内裸名 `mise run <task>` 与 `mise -C` 形式同样可用：

| 任务        | 声明位置                                                                                                                                                        | 作用                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changelog` | 根 `.mise/tasks/changelog.ps1`（文件任务 `//:changelog`，`#MISE dir="{{cwd}}"`）；各包 `mise.toml` 声明 `[tasks.changelog] run = "mise run //:changelog"` + env | 共享逻辑唯一实现：读 `meta.json` 版本 → `git cliff -t "<pkg>@<version>" -o <输出文件>` 全量重写 → 追加旧日志存档（如提供）→ `prettier -w` → `git add`。输出文件名（env `CHANGELOG_OUTPUT`）与旧日志文件名（env `CHANGELOG_LEGACY`，空 = 跳过存档）不用脚本参数，由包内 `env` 静态声明；子任务 env 随嵌套 `mise run` 按普通子进程继承（2026.11.8 实测），`dir="{{cwd}}"` 使执行目录 = 嵌套调用发起处（包目录） |
| `release`   | `sy-format-helper` 的 `.mise/tasks/release.ps1`（file 任务）                                                                                                    | 依次校验 `package.json` 与 `meta.json` 版本一致、工作区干净、当前在 `main`、本地与 `origin/main` 同步、本地/远端无同名 tag、`whatschange.md` 已含该版本段落，最后 `git tag -a "<pkg>@<version>" -m ''` 并推送                                                                                                                                                                                                 |

根 `.mise/tasks/` 另提供两个跨包任务：

| 任务     | 用法                                                      | 作用                                                                                                                                                      |
| -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tag`    | `mise run tag`                                            | 扫描 `packages/*/*/meta.json`；tag 已存在、版本未变或 `meta.json` 有未提交改动时跳过，否则 `git tag -a "<pkg>@<version>" -m ''`，只建本地 tag，需手动推送 |
| `deploy` | `mise run deploy -- -package <pkg> [-target <ws>] [-all]` | `pnpm --filter <pkg> build` 后把 `dist/*` 镜像同步到 `<workspace>/data/<类型目录>/<pkg>`                                                                  |

`deploy` 的包类型映射：`plugin→plugins`、`theme→themes`、`widget→widgets`、`template→templates`、`icon→icons`，目标目录即 `data/<该目录>/<包名>`。`dist/` 顶层就是插件根（`index.js`、`plugin.json`、`i18n/`、README、图标），脚本用 `Copy-Item (Join-Path $distDir '*')` 复制目录内容而非目录本身，因此部署后不会再套一层 `dist`。部署前会先 `Remove-Item -Recurse` 清空目标目录，手改过的文件会被覆盖；`-all` 优先于 `-target`，省略 `-target` 时用当前打开的工作空间。脚本依赖 mise 注入的 `MISE_CONFIG_ROOT`，只能通过 `mise run deploy --` 调用。

发布顺序：改 `meta.json` 的版本 → 提交（pre-commit 自动同步 `package.json` 并生成 changelog）→ 推送 `main` → `mise run tag` → 推送 tag 触发 CI。

**每个包都必须有 `changelog` 任务**：根 `.lefthook/pre-commit/changelog.ps1` 通过 `mise -C <pkg> run changelog` 调用它，缺任务会让提交失败（`mise ERROR no task //packages/plugin/<pkg>:changelog found`）。插件包在包内 `mise.toml` 声明 `[tasks.changelog] run = "mise run //:changelog"`（逻辑唯一实现在根文件任务，不要逐包复制脚本；输出/旧日志文件名用 env `CHANGELOG_OUTPUT` / `CHANGELOG_LEGACY` 声明）；不需生成 changelog 的包（如内部 lib）用 `[tasks.changelog] run = ""` 占位即可。

pre-commit 还有两个 job：`prettier`（`stage_fixed: true` 自动回写格式化结果）和 `syncversion.ps1`（把 `meta.json` 的 version 写回 `package.json` 并单独 `git add`）。三者都会改动暂存区，若偶发 `index.lock` 冲突可把 `pre-commit.parallel` 改为 `false`。

### 发布流水线

`.github/workflows/release.yml` 由 tag push（`*@*`）触发，也可 `workflow_dispatch` 手动补发：

1. `scripts/parse-tag.mjs` 解析 `<pkg>@<version>`，扫描 `packages/*/<pkg>` 要求**恰好命中 1 个**目录，输出 `name/version/meta_version/matched/reason/type/dir/owner`。`packages` 目录或 `meta.json` 缺失（迁移前提交、旧版本 tag）、`meta.json.version` 与 tag 不一致时输出 `matched=false`；tag 格式错误、包目录匹配数不为 1、`bazaar.json` 结构缺失仍然中断。
2. `Check whether to release` 汇总跳过条件（`matched=false`，或 `gh release view` 显示目标仓库已有该版本），输出 `skip`。其中 `release not found|HTTP 404` 视为未发布，其他错误（如 `RELEASE_TOKEN` 无效）直接失败。后续所有步骤条件统一为 `if: steps.state.outputs.skip != 'true'`。
3. `pnpm --filter <pkg> build`，`TAG_VERSION` 传入以在构建期再校验一次版本。
4. `git cliff --config <pkg>/cliff.toml --latest -o release.md` 生成 release notes。
5. `jq-action` 读取**产物** `dist/plugin.json` 的 `version`，与 tag 版本比对；最终 `tag_name` 取自产物而非 tag，保证与集市读到的版本同源。
6. `Sync metadata to target repo`：把 `dist/` 下的 `plugin.json`、`icon.png`、`preview.png` 提交并推送到目标仓库 `main`，使下一步以 `target_commitish: main` 创建的 tag 指向这份含元数据的提交（checkout tag 即可看到完整元数据与图标）。带 `continue-on-error: true`，失败只告警不影响发布；`git status --porcelain` 为空时跳过提交；提交身份取仓库变量 `vars.COMMIT_NAME` / `vars.COMMIT_EMAIL`。
7. `softprops/action-gh-release` 通过 `repository: <owner>/<pkg>` + `token: secrets.RELEASE_TOKEN` 发布到独立仓库，`target_commitish: main`，`fail_on_unmatched_files: true`。

子仓库的 tag 是**裸版本号**（`0.7.1`），不给 `v` 前缀也不带包名；monorepo 的 tag 才是 `<pkg>@<version>`。跨仓发布必须用 PAT 或 GitHub App token（`GITHUB_TOKEN` 只能作用于本仓库），且目标仓库必须已有 `main` 分支（stub 初始化）。

**单次运行只处理 1 个包**：`parse-tag.mjs` 一次只解析一个 tag，且要求 `packages/*/<pkg>` 恰好命中 1 个目录；工作流是单 job、没有 `strategy.matrix`，`workflow_dispatch` 的 `inputs.tag` 也只有一个字符串。多包发布需推多个 tag，由 GitHub 为每个 tag 各自创建一次运行并行执行（`concurrency.group = release-<tag>` 按 tag 隔离：同 tag 排队不并行，不同 tag 完全并行）。因此每次运行都会重复 `checkout --fetch-depth 0` 与 `pnpm install --frozen-lockfile`，发 N 个包就有 N 次重复开销，只有 `pnpm --filter <pkg> build` 是单包范围。若要一次运行处理多包，需改成 matrix（拆分 `inputs.tags` 为列表）或加 pnpm store 缓存压低重复成本。

### 元数据字段校验

`node scripts/validate-meta.mjs`（仓库根运行）校验各包 `dist/<type>.json` 是否符合集市要求，任一失败即退出码 1。规则来源是 `siyuan-note/plugin-sample` 的 README 与 `plugin.json`（0.5.2）以及集市规则（`siyuan-note/bazaar` 的 `rules/`）：

| 校验项       | 规则                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 必需字段     | `name`、`author`、`url`、`version`、`minAppVersion`、`displayName`、`description`、`readme`，多语言字段的 `default` 子字段必须存在 |
| `name`       | 必须与包目录一致（集市要求 name 与仓库名一致）                                                                                     |
| `version`    | 符合 semver                                                                                                                        |
| 主题 `modes` | 仅允许 `light` / `dark`                                                                                                            |
| `icon`       | 文件在产物中、≤ 64 KiB、不支持 SVG                                                                                                 |
| `preview`    | 文件在产物中、≤ 512 KiB                                                                                                            |
| 版本联动     | `settingsWindow: true` 需 `minAppVersion >= 3.8.7`；`publish.resources` 含目录声明需 `>= 3.8.6`                                    |

可选字段 `kernels`（仅含 `kernel.js` 时需要）、`publish`、`bootAppearances`、`settingsWindow` 当前均未声明，属按需状态；`icon` 建议尺寸 160×160、`preview` 建议 1024×768。脚本对**产物**校验而非源码，所以总是先 `pnpm -r build` 再校验。

### changelog 配置

每个包一份 `cliff.toml`，其中两项**必须逐包修改**：

```toml
[git]
tag_pattern = "^<pkg>@"                              # 只用本包 tag 作为版本锚点
include_paths = ["packages/<type>/<pkg>/**"]         # 键名是复数，值为 glob 数组
```

`tag_pattern` 只做筛选、**不会**从 tag 名提取版本号，所以标题用 `version | split(pat="@") | last` 渲染成 `0.7.1`；而 `compare` 链接必须使用**完整 tag 名**（`previous.version` / `version`），因为 monorepo 的 tag 带包名前缀，用裸版本号会 404。`include_paths` 的值必须能匹配到文件层级（`/**` 或带尾斜杠的目录形式），写纯目录会导致所有提交被过滤、cliff 认不出 tag 并退化为 `## [unreleased]`。

`postprocessors` 的 `<REPO>` 指向**当前 monorepo**（`https://github.com/<owner>/siyuan-packages`）：commit 只存在于 monorepo，子仓库不再推送代码。`output` 指向包内 `whatschange.md`，CI 用 `-o release.md` 覆盖输出，不会污染包内文件。

历史版本无法由 cliff 重新生成：`git subtree add` 保留的是原仓库提交对象，它们的 diff 路径是原仓库根（`src/`、`package.json`、`plugin.json`），不匹配 `packages/<type>/<pkg>/**`（实测命中 0），因此历史 tag 全部失效、cliff 只能输出当前版本段落。历史记录保存在 `whatschange.old.md`，由 `changelog` 任务在生成后追加；也正因为如此，**不要在已发布版本上运行 `changelog`**，否则会产生重复段落。

### 忽略规则的设计意图

根 `.gitignore` 中 `index.js` / `index.css` 是**故意全局忽略**的（dev 产物），将来若有包需要把同名文件作为源码提交，需按包单独 `!` 放行，并同步在 `.prettierignore` 加 `!`（prettier 也读 `.gitignore`）。`packages/plugin/*/i18n/` 与 `packages/plugin/*/plugin.json` 是产物。

prettier 的 ignore 文件只在**当前工作目录**查找、不向上搜索，因此格式化统一走根 `pnpm format`（`prettier -w .`）；若某包将来要自定义格式化脚本，必须显式列出路径（如 `prettier -w src README*.md`），不能写 `prettier -w .`，否则在包目录下会去格式化 `dist/`。

## 新增一个包

新增包有两种来源：迁移既有仓库，或从官方模板新建。两者的改造终点相同，起点差异如下：

|                       | 迁移既有仓库（git subtree）                 | 官方模板新建（`siyuan-note/plugin-sample-vite-vue`）                                            |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 历史 tag 与已发布记录 | 有，需 `whatschange.old.md` 存档            | 无，首个版本从 `0.0.1` 直接开始                                                                 |
| 中文 README           | 旧仓库可能是 `README_zh_CN.md`，需重命名    | 官方已是 `README.zh-CN.md`                                                                      |
| 自带 AI 指引          | 可能有 `CODEBUDDY.md` / `AGENTS.md`         | 无                                                                                              |
| 包名                  | 与目录一致，无需改                          | 需把模板名 `plugin-sample-vite-vue` 改为新包名                                                  |
| `mise.toml`           | 可能有 `[env]`，只删 `[tools]` / `[deps.*]` | 模板无 mise 配置，无需处理                                                                      |
| 演示代码              | 无                                          | `src/` 含模板示例（`App.vue` 菜单示例、`components/SiyuanTheme`、`types/`、`utils/`），按需保留 |

### 共通改造

1. 把源 `plugin.json` 拆成 `meta.json`（独有字段 + `version`），不要提交 `plugin.json`（构建产物）；`author`、`backends`、`disabledInPublish`、`icon`、`preview`、`readme`、`funding` 由 `bazaar.json` 提供，不要写进 meta；多语言键用横线 `zh-CN`（与 `i18n/zh_CN.json` 的下划线不同）
2. 构建接入：
   - **esbuild 包**（无 `vite.config.ts`）：`package.json` 的 `build` / `dev` 指向 `../../../scripts/build-plugin.mjs`
   - **vite 包**：包内 `vite.config.ts` 改为转发根 `createPluginViteConfig({ pkgDir: import.meta.dirname, deps: { defineConfig, loadEnv, vue, fg, minimist, livereload, viteStaticCopy, zipPack } })`（含 `emitPluginJson` 输出产物 `plugin.json` 与 i18n `stripBase`）；源码 `@/../plugin.json` → `@/../meta.json`；watch 监听 `./meta.json` 与根 `../../../bazaar.json`（工厂默认已含）；`tsconfig.json` 继承 `../../../tsconfig.base.json`
3. `package.json` 精简：scripts 为 `lint`（oxlint）/ `dev` / `build` / `clean`，删除 `release*`；devDeps 只留构建所需并升级到 monorepo 现行版本（模板自带 vite 6、eslint 9、@antfu/eslint-config 4、ts-node、glob、@vue/tsconfig 一律不要），`vue` 移到 devDeps，`siyuan` 统一 `1.3.0`；`rimraf`、`@types/*` 由根提供不再声明；不写 `author`、`description`、`devEngines`、`homepage`、`repository` 等发布用字段，`version` 由 pre-commit 的 `syncversion.ps1` 自动对齐
4. 新建包内 `cliff.toml`：改 `tag_pattern`、`include_paths`、`output`（`whatschange.md`）、`<REPO>`，标题用 `split(pat="@") | last`（详见「changelog 配置」）
5. 包内 `mise.toml` 声明 `[tasks.changelog] run = "mise run //:changelog"`（输出/旧日志文件名非缺省时加 `env = { CHANGELOG_OUTPUT = "...", CHANGELOG_LEGACY = "..." }`；内部 lib / 不需生成的包写 `[tasks.changelog] run = ""` 占位，否则 pre-commit 会失败）
6. 补包内 `AGENTS.md`：构建栈、模块职责、i18n 命名、隐性约定
7. 验证：根 `pnpm install` → `pnpm -r build` → `pnpm lint` → `pnpm exec tsc --noEmit -p packages/plugin/<pkg>/tsconfig.json` → `mise run //packages/plugin/<pkg>:changelog`（包目录内亦可 `mise run changelog`）；确认 `dist/plugin.json` 的 `name` / `url` / `version` 为派生值。新包落在 `config_roots` glob 内，其 scripts 与任务会自动出现在根目录 `mise tasks --all`
8. 发布：初始化目标仓库 stub（README 重定向 + `.github/ISSUE_TEMPLATE/config.yml`）并提供 `main` 分支，`mise run tag` 后推送 tag

### 迁移来源的差异步骤

1. `git subtree add --prefix=packages/<type>/<pkg> <repo> main`
2. 删除 `mise.lock`、`lefthook.yml`、`.prettierrc`、`.gitignore`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.mise/locks/`、`.vscode/`、`.github/`、`build.mjs`、`release.js`、`.oxlintrc.json`、`CHANGELOG.md`、原仓库 AI 指引；`mise.toml` 只删 `[tools]` / `[deps.*]`
3. 把旧仓库的 `whatschange.md` 存为 `whatschange.old.md` 并迁移其中链接；历史 tag 在 cliff 中全部失效（subtree 保留的提交路径不匹配 `packages/**`，实测命中 0），**不要在已发布版本上运行 `changelog`**
4. `README_zh_CN.md` 等旧命名重命名为 `README.zh-CN.md`

### 官方模板新建的差异步骤

1. `git clone --depth=1 https://github.com/siyuan-note/plugin-sample-vite-vue packages/plugin/<newpkg>` 并删除其中的 `.git` 与 `.github/`
2. 删除 `release.js`、`eslint.config.mjs`、`CHANGELOG.md`、`.editorconfig`（monorepo 未使用）；保留 `.env.example`（`VITE_SIYUAN_WORKSPACE_PATH` 的用法说明）与 `asset/`
3. 模板 `viteStaticCopy` 按 `plugin.json` 的 `icon` / `preview` 字段动态生成图片 targets——改造后改为从 `resolvePluginMeta` 返回的 `meta.icon` / `meta.preview` 派生
4. 官方模板的 i18n 复制无 `stripBase`，必须补 `rename: { stripBase: 2 }`，否则产物出现 `dist/i18n/src/i18n/*.json` 嵌套（`siyuan-ignoreeditor` 与 `plugin-vscodelite-edit` 都踩过）
5. 演示代码取舍：`src/components/SiyuanTheme/`（主题控件）、`src/types/`（思源类型）、`src/utils/`（挂载工具）通常保留；`App.vue` 的示例逻辑按新包功能重写
6. 模板 `package.json` 无 `clean` / `lint` script，需补上；devDeps 需整体升级（模板 vite 6、@vitejs/plugin-vue 5、siyuan 1.1.0 均落后于 monorepo 现行版本）
7. 首次发布：`mise run tag` 生成 `<pkg>@0.0.1`，推送后触发 CI

### 官方最简示例的两条特殊路线

#### theme-sample（主题包，零构建）

官方主题示例只有 9 个文件：`theme.json`、`theme.css`、`icon.png`、`preview.png`、README×2、`CHANGELOG.md`、`LICENSE`——**没有 `src/`、没有构建器、没有任何 npm 依赖**，源码即产物。`theme.json` 字段与 `plugin.json` 几乎同构（`name`/`author`/`url`/`version`/`minAppVersion`/`displayName`/`description`/`readme`/`icon`/`preview`/`funding`/`keywords`），差异是没有 `backends`、多了 `modes`（`["light"]` / `["dark"]` / `["light","dark"]`）。

接入前需要先扩展基础设施（当前全部面向插件）：

1. `bazaar.json` 增加 `types.theme` 模板：`author`、`icon`、`preview`、`readme`、`funding`；`modes` 是包特有字段，写进包内 `meta.json`
2. `scripts/plugin-meta.mjs` 的 `REQUIRED_FIELDS` 需按 `pkgType` 区分：主题不含 `backends`（也不含 `frontends`，主题清单无此字段）；`metaFile = \`${pkgType}.json\``会自动输出`theme.json`，现有代码无需改动
3. `deploy.ps1` 的映射已有 `theme = 'themes'`，但脚本会先执行 `pnpm --filter <pkg> build`——主题无构建脚本，需改为跳过构建、把包根（`theme.json`、`theme.css`、图标）直接镜像到 `data/themes/<pkg>`
4. `release.yml` 的 `pnpm --filter <pkg> build` 对无 build script 的包会报错，`package.zip` 也需另行生成（PowerShell `Compress-Archive` 或独立 zip 步骤）——接入第一个主题包时一并处理
5. `tsconfig.base.json` 对主题无意义（没有 TS 源码），`tsconfig.json` 可省略

#### plugin-sample（webpack 双入口）

官方最简插件用 **webpack 5 双配置**（`webpack.config.js` 前端 + `webpack.kernel.config.js` 内核）：dev 时 `run-p` 并行监听两个配置，build 时 `run-s` 先 kernel 后 app 串行；转译用 `esbuild-loader`，格式化用 `dprint`（非 prettier），另有 `patches/`（pnpm patch）与 `tests/`（node --test）。

迁移路线按需选择：

| 路线         | 做法                                                                                                                                       | 适用                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 迁 vite      | 与现有 vite 包同构；kernel 产物用 `build.rollupOptions.input` 第二入口或 `--config` 第二个配置文件输出到不同目录                           | kernel 产物只是静态资源      |
| 迁 esbuild   | 删掉 webpack 全家（webpack、webpack-cli、copy/zip/mini-css 插件、sass-loader、npm-run-all 共 10+ 依赖）；`build-plugin.mjs` 需扩展为多入口 | 想统一到根构建脚本           |
| 保留 webpack | 包内自洽（webpack、esbuild-loader、zip-webpack-plugin 留在包内），根只管聚合；`tsconfig` 仍继承 base                                       | 内核构建逻辑复杂、不值得重写 |

无论哪条路线：`dprint` 换成 prettier（根已配置），`patches/` 的依赖补丁逐个确认是否仍必要；双入口的 `build` 编排（`run-p` / `run-s`）可用 `npm-run-all` 保留或改用 pnpm 的并行 script（`pnpm run --filter` / `&`）
