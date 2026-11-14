# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

思源（SiYuan）插件 monorepo。每个子包最终都要发布到自己的独立 GitHub 仓库，因为思源集市按「仓库」查找 `tag == version` 的 release 并下载其中的 `package.zip`。

## 常用命令

```bash
mise install                      # 安装 node / pnpm / prettier / git-cliff / lefthook
pnpm install                      # 安装根与所有 workspace 包的依赖
pnpm -r build                     # 构建全部包（各包调用根 scripts/build-plugin.mjs）
pnpm --filter sy-format-helper build   # 单包 production 构建，产出 <pkg>/dist 与 <pkg>/package.zip
pnpm --filter sy-format-helper dev     # esbuild watch，产物写到包根，便于软链到思源插件目录调试
pnpm lint                         # eslint packages/plugin
pnpm lint:fix                     # 同上并自动修复，带 .eslintcache
pnpm format                       # prettier -w .（读根 .prettierrc 与 .prettierignore）
pnpm -r clean                     # 删除各包 dist 与 package.zip
```

没有测试框架，也没有测试脚本；质量门禁是 `pnpm lint`、`prettier -c .` 与 `pnpm -r build` 三者。

### 单包本地构建

包名取 `package.json` 的 `name`（当前 `sy-format-helper`，与目录名一致）。三种等价入口：

```bash
pnpm --filter sy-format-helper build                      # 根目录，按包名
pnpm --filter ./packages/plugin/sy-format-helper build    # 根目录，按目录
cd packages/plugin/sy-format-helper && pnpm build         # 包目录内
```

产物位置按模式区分。构建实现分两类：esbuild 包走 `scripts/build-plugin.mjs`（包内脚本只做转发），vite 包保留包内 `vite.config.ts`；两类构建的元数据合成统一由 `scripts/plugin-meta.mjs` 的 `resolvePluginMeta()` 提供，`plugin.json` 一律是产物而非源文件：

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

- **mise** 管运行时与 CLI：`node`、`pnpm`、`prettier`、`git-cliff`、`lefthook`。根 `mise.toml` 用 monorepo 模式（`monorepo_root = true`、`config_roots = ["packages/plugin/*"]`）。
- **根 `package.json`** 只放 lint 工具链（eslint 全家、typescript），脚本是 workspace 级聚合。
- **包内 `package.json`** 只放构建链（esbuild、sass、jszip、rimraf）与 `siyuan` 类型；`prettier` 不装（mise 提供，避免双版本漂移）。
- 包内**不要**放 `lefthook.yml`、`.prettierrc`、`.gitignore`、`eslint.config.mjs`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`——这些只认根级，子目录里的不生效。
- 包内 `.mise/tasks/` 会被 mise 识别为任务（无需包内 `mise.toml`），但必须用 `mise -C <pkgDir> run <task>` 调用，根目录下看不到子包任务。当前有 `changelog` 与 `release` 两个任务。

### Git hooks

根 `lefthook.yml` 只有 `pre-commit` 一个 job：对 `{staged_files}` 按 glob 过滤后执行 `prettier -w`，并带 `stage_fixed: true`（否则格式化结果不会进入本次提交）。glob 覆盖 `ts/tsx/mts/cts/js/jsx/mjs/cjs`、`scss/css/less`、`md`、`json/jsonc/json5`、`yaml/yml`。

`.prettierrc` 的 `endOfLine: "auto"` 是为 Windows（`core.autocrlf=true`，工作区 CRLF）与 CI（LF）共存设置的，不要改回 `lf`。

### 本地发布任务

包内 `.mise/tasks/` 提供两个 PowerShell 任务，都必须在包目录下运行（`mise -C packages/plugin/<pkg> run <task>`），因为脚本用 `Get-Location` 定位包目录：

| 任务        | 作用                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changelog` | 读 `meta.json` 版本 → `git cliff -t "<pkg>@<version>" -o whatschange.md` 全量重写 → 追加 `whatschange.old.md` 历史存档 → `prettier -w` → `git add`                                                            |
| `release`   | 依次校验 `package.json` 与 `meta.json` 版本一致、工作区干净、当前在 `main`、本地与 `origin/main` 同步、本地/远端无同名 tag、`whatschange.md` 已含该版本段落，最后 `git tag -a "<pkg>@<version>" -m ''` 并推送 |

发布顺序：改 `meta.json` 的版本 → 提交（pre-commit 自动同步 `package.json` 并生成 changelog）→ 推送 `main` → `mise run tag` → 推送 tag 触发 CI。

**每个包都必须有 `changelog` 任务**：根 `.lefthook/pre-commit/changelog.ps1` 通过 `mise -C <pkg> run changelog` 调用它，缺任务会让提交失败（`mise ERROR no task //packages/plugin/<pkg>:changelog found`）。不需要生成 changelog 的包（如纯资源包）必须创建一个**空任务占位**——`.mise/tasks/changelog.ps1` 内容可以只有一行注释，保证任务能被 mise 识别即可。

pre-commit 还有两个 job：`prettier`（`stage_fixed: true` 自动回写格式化结果）和 `syncversion.ps1`（把 `meta.json` 的 version 写回 `package.json` 并单独 `git add`）。三者都会改动暂存区，若偶发 `index.lock` 冲突可把 `pre-commit.parallel` 改为 `false`。

### 发布流水线

`.github/workflows/release.yml` 由 tag push（`*@*`）触发，也可 `workflow_dispatch` 手动补发：

1. `scripts/parse-tag.mjs` 解析 `<pkg>@<version>`，扫描 `packages/*/<pkg>` 要求**恰好命中 1 个**目录，输出 `name/version/meta_version/matched/reason/type/dir/owner`。`packages` 目录或 `meta.json` 缺失（迁移前提交、旧版本 tag）、`meta.json.version` 与 tag 不一致时输出 `matched=false`；tag 格式错误、包目录匹配数不为 1、`bazaar.json` 结构缺失仍然中断。
2. `Check whether to release` 汇总跳过条件（`matched=false`，或 `gh release view` 显示目标仓库已有该版本），输出 `skip`。其中 `release not found|HTTP 404` 视为未发布，其他错误（如 `RELEASE_TOKEN` 无效）直接失败。后续所有步骤条件统一为 `if: steps.state.outputs.skip != 'true'`。
3. `pnpm --filter <pkg> build`，`TAG_VERSION` 传入以在构建期再校验一次版本。
4. `git cliff --config <pkg>/cliff.toml --latest -o release.md` 生成 release notes。
5. `jq-action` 读取**产物** `dist/plugin.json` 的 `version`，与 tag 版本比对；最终 `tag_name` 取自产物而非 tag，保证与集市读到的版本同源。
6. `softprops/action-gh-release` 通过 `repository: <owner>/<pkg>` + `token: secrets.RELEASE_TOKEN` 发布到独立仓库，`target_commitish: main`，`fail_on_unmatched_files: true`。

子仓库的 tag 是**裸版本号**（`0.7.1`），不给 `v` 前缀也不带包名；monorepo 的 tag 才是 `<pkg>@<version>`。跨仓发布必须用 PAT 或 GitHub App token（`GITHUB_TOKEN` 只能作用于本仓库），且目标仓库必须已有 `main` 分支（stub 初始化）。

**单次运行只处理 1 个包**：`parse-tag.mjs` 一次只解析一个 tag，且要求 `packages/*/<pkg>` 恰好命中 1 个目录；工作流是单 job、没有 `strategy.matrix`，`workflow_dispatch` 的 `inputs.tag` 也只有一个字符串。多包发布需推多个 tag，由 GitHub 为每个 tag 各自创建一次运行并行执行（`concurrency.group = release-<tag>` 按 tag 隔离：同 tag 排队不并行，不同 tag 完全并行）。因此每次运行都会重复 `checkout --fetch-depth 0` 与 `pnpm install --frozen-lockfile`，发 N 个包就有 N 次重复开销，只有 `pnpm --filter <pkg> build` 是单包范围。若要一次运行处理多包，需改成 matrix（拆分 `inputs.tags` 为列表）或加 pnpm store 缓存压低重复成本。

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

## 新增一个包的步骤

1. `git subtree add --prefix=packages/<type>/<pkg> <repo> main`
2. 删除包内的 `mise.toml`、`mise.lock`、`lefthook.yml`、`.prettierrc`、`.gitignore`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.mise/locks/`、`.vscode/`、`.github/`、`build.mjs`、`release.js`、`eslint.config.mjs`、`CHANGELOG.md`、`CODEBUDDY.md`
3. 把源 `plugin.json` 拆成 `meta.json`（独有字段 + `version`）并 `git rm --cached` 原文件；`author`、`backends`、`disabledInPublish`、`icon`、`preview`、`readme`、`funding` 由 `bazaar.json` 提供，不要写进 meta；多语言键用横线 `zh-CN`（与 `i18n/zh_CN.json` 的下划线不同）
4. 按原包构建方式二选一：
   - **esbuild 包**（无 `vite.config.ts`）：`package.json` 的 `build` / `dev` 指向 `../../../scripts/build-plugin.mjs`
   - **vite 包**：保留包内 `vite.config.ts`，把 `import pluginInfo from './plugin.json'` 换成 `resolvePluginMeta({ pkgDir: __dirname })`，再注册一个 `generateBundle` 插件用 `emitFile` 输出 `plugin.json`；源码里 `@/../plugin.json` 的引用改为 `@/../meta.json`，watch 的监听列表改为 `./meta.json` 与 `../../../bazaar.json`
5. 包内 `package.json` 只留构建依赖（esbuild 包：esbuild、sass、jszip、rimraf；vite 包：vite、@vitejs/plugin-vue、vite-plugin-static-copy、vite-plugin-zip-pack、vue、sass、rimraf 等）与 `siyuan`，脚本为 `dev` / `build` / `clean` / `lint`；`version` 由 pre-commit 的 `syncversion.ps1` 在提交时从 `meta.json` 自动对齐，不写 `main`、`keywords`、`author`、`description`、`devEngines`、`homepage`、`repository` 等发布用字段
6. 新建包内 `cliff.toml`，只需改 `tag_pattern`、`include_paths`、`output`（`whatschange.md`）与 `postprocessors` 的 `<REPO>`（统一指向 monorepo，与包名无关），并把模板标题的 `trim_start_matches(pat="v")` 改成 `split(pat="@") | last`；从未发布过的包无需 `whatschange.old.md`，迁移包则把旧 `whatschange.md` 存为 `whatschange.old.md` 并迁移其中链接
7. 提供包内 `.mise/tasks/changelog.ps1`（可直接复制现有包）；不需要该任务的包也必须建**空任务占位**，否则 pre-commit 会因 `mise run changelog` 找不到任务而失败
8. 根 `pnpm install`，再跑 `pnpm -r build` 与 `pnpm lint`；确认 `dist/plugin.json` 的 `name` / `url` / `version` 为派生值
9. 在根 `.gitignore` 无需新增规则；在目标仓库初始化 stub（README 重定向 + `.github/ISSUE_TEMPLATE/config.yml`）并提供 `main` 分支
