# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

思源（SiYuan）插件 monorepo。每个子包最终都要发布到自己的独立 GitHub 仓库，因为思源集市按「仓库」查找 `tag == version` 的 release 并下载其中的 `package.zip`。

## 常用命令

```bash
mise install                      # 安装 node / pnpm / prettier / git-cliff / lefthook
pnpm install                      # 安装根与所有 workspace 包的依赖
pnpm -r build                     # 构建全部包（各包执行 node build.mjs --production）
pnpm --filter sy-format-helper build   # 单包 production 构建，产出 <pkg>/dist 与 <pkg>/package.zip
pnpm --filter sy-format-helper dev     # esbuild watch，产物写到包根，便于软链到思源插件目录调试
pnpm lint                         # eslint packages/plugin
pnpm lint:fix                     # 同上并自动修复，带 .eslintcache
pnpm format                       # prettier -w .（读根 .prettierrc 与 .prettierignore）
pnpm -r clean                     # 删除各包 dist 与 package.zip
```

没有测试框架，也没有测试脚本；质量门禁是 `pnpm lint`、`prettier -c .` 与 `pnpm -r build` 三者。

发布靠 push tag 触发 CI，不要在本地手动建 release：

```bash
git tag -a "sy-format-helper@0.7.1" -m "release sy-format-helper 0.7.1"
git push origin "sy-format-helper@0.7.1"
```

仓库配置了 `tag.gpgSign = true`，必须用 `-a -m`；裸 `git tag <name>` 会打开编辑器并失败。

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

`build.mjs` 的 `composeMeta()` 负责：`bazaar.types[type]` 与 `meta.json` 深合并（对象递归、数组整体替换）→ `${owner}/${name}/${version}` 占位符替换 → 派生 `name`（目录名）、`url`（`https://github.com/<owner>/<name>`）、`version` → 校验。

规则：`meta.json` **禁止**出现 `name` / `url`（构建期派生，出现即报错）；12 个必填字段缺失即失败；`readme` / `icon` / `preview` / `publish.resources` 必须在产物目录存在；环境变量 `TAG_VERSION` 存在时必须等于 `meta.version`。

产物目录随模式变化：production 写 `dist/`，development 写**包根**（`index.js`、`index.css`、`i18n/`、`plugin.json` 都是产物，已被 `.gitignore` 忽略）。这是为了让包目录能直接软链成思源插件目录。

### 构建实现

`packages/<type>/<pkg>/build.mjs` 用 esbuild JS API，不是 webpack：`bundle: true`、`format: 'cjs'`、`external: ['siyuan']`、`target: 'es6'`、production 时 `minify` 并把 `LICENSE` 通过 `banner.js` 注入。SCSS 由自定义 plugin 用 `sass.compileAsync` 转成 CSS 后以 `loader: 'css'` 交回 esbuild，自动产出与 `outfile` 同名的 `.css`。静态资源（`icon.png`、`preview.png`、`README*.md`）用 `fs.copyFile`，`src/i18n/` 用 `fs.cp`，最后由 `jszip` 把 `dist/` 扁平化打成 `package.zip`。

### 工具链分层

- **mise** 管运行时与 CLI：`node`、`pnpm`、`prettier`、`git-cliff`、`lefthook`。根 `mise.toml` 用 monorepo 模式（`monorepo_root = true`、`config_roots = ["packages/plugin/*"]`）。
- **根 `package.json`** 只放 lint 工具链（eslint 全家、typescript），脚本是 workspace 级聚合。
- **包内 `package.json`** 只放构建链（esbuild、sass、jszip、rimraf）与 `siyuan` 类型；`prettier` 不装（mise 提供，避免双版本漂移）。
- 包内**不要**放 `lefthook.yml`、`.prettierrc`、`.gitignore`、`eslint.config.mjs`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`——这些只认根级，子目录里的不生效。
- 包内 `.mise/tasks/` 会被 mise 识别为任务（无需包内 `mise.toml`），但必须用 `mise -C <pkgDir> run <task>` 调用，根目录下看不到子包任务。

### Git hooks

根 `lefthook.yml` 只有 `pre-commit` 一个 job：对 `{staged_files}` 按 glob 过滤后执行 `prettier -w`，并带 `stage_fixed: true`（否则格式化结果不会进入本次提交）。glob 覆盖 `ts/tsx/mts/cts/js/jsx/mjs/cjs`、`scss/css/less`、`md`、`json/jsonc/json5`、`yaml/yml`。

`.prettierrc` 的 `endOfLine: "auto"` 是为 Windows（`core.autocrlf=true`，工作区 CRLF）与 CI（LF）共存设置的，不要改回 `lf`。

### 发布流水线

`.github/workflows/release.yml` 由 tag push（`*@*`）触发，也可 `workflow_dispatch` 手动补发：

1. `scripts/parse-tag.mjs` 解析 `<pkg>@<version>`，扫描 `packages/*/<pkg>` 要求**恰好命中 1 个**目录，输出 `name/version/meta_version/matched/reason/type/dir/owner`。`packages` 目录或 `meta.json` 缺失（迁移前提交、旧版本 tag）、`meta.json.version` 与 tag 不一致时输出 `matched=false`；tag 格式错误、包目录匹配数不为 1、`bazaar.json` 结构缺失仍然中断。
2. `Check whether to release` 汇总跳过条件（`matched=false`，或 `gh release view` 显示目标仓库已有该版本），输出 `skip`。其中 `release not found|HTTP 404` 视为未发布，其他错误（如 `RELEASE_TOKEN` 无效）直接失败。后续所有步骤条件统一为 `if: steps.state.outputs.skip != 'true'`。
3. `pnpm --filter <pkg> build`，`TAG_VERSION` 传入以在构建期再校验一次版本。
4. `git cliff --config <pkg>/cliff.toml --latest -o release.md` 生成 release notes。
5. `jq-action` 读取**产物** `dist/plugin.json` 的 `version`，与 tag 版本比对；最终 `tag_name` 取自产物而非 tag，保证与集市读到的版本同源。
6. `softprops/action-gh-release` 通过 `repository: <owner>/<pkg>` + `token: secrets.RELEASE_TOKEN` 发布到独立仓库，`target_commitish: main`，`fail_on_unmatched_files: true`。

子仓库的 tag 是**裸版本号**（`0.7.1`），不给 `v` 前缀也不带包名；monorepo 的 tag 才是 `<pkg>@<version>`。跨仓发布必须用 PAT 或 GitHub App token（`GITHUB_TOKEN` 只能作用于本仓库），且目标仓库必须已有 `main` 分支（stub 初始化）。

### changelog 配置

每个包一份 `cliff.toml`，其中两项**必须逐包修改**：

```toml
[git]
tag_pattern = "^<pkg>@"                              # 只用本包 tag 作为版本锚点
include_paths = ["packages/<type>/<pkg>/**"]         # 键名是复数，值为 glob 数组
```

`tag_pattern` 只做筛选、**不会**从 tag 名提取版本号，所以模板头部用 `version | split(pat="@") | last` 剥离包名前缀，`previous.version` 同理。`include_paths` 的值必须能匹配到文件层级（`/**` 或带尾斜杠的目录形式），写纯目录会导致所有提交被过滤、cliff 认不出 tag 并退化为 `## [unreleased]`。

`cliff.toml` 里 `postprocessors` 的 `<REPO>` 指向子仓库 URL，`output` 指向包内 changelog 文件；CI 用 `-o release.md` 覆盖输出，不会污染包内文件。

### 忽略规则的设计意图

根 `.gitignore` 中 `index.js` / `index.css` 是**故意全局忽略**的（dev 产物），将来若有包需要把同名文件作为源码提交，需按包单独 `!` 放行，并同步在 `.prettierignore` 加 `!`（prettier 也读 `.gitignore`）。`packages/plugin/*/i18n/` 与 `packages/plugin/*/plugin.json` 是产物。

prettier 的 ignore 文件只在**当前工作目录**查找、不向上搜索，因此包内脚本必须显式列出路径（`prettier -w src README*.md`），不能写 `prettier -w .`，否则包目录下会格式化 `dist/`。

## 新增一个包的步骤

1. `git subtree add --prefix=packages/<type>/<pkg> <repo> main`
2. 删除包内的 `mise.toml`、`mise.lock`、`lefthook.yml`、`.prettierrc`、`.gitignore`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.mise/`、`.vscode/`、`.github/`
3. 把源 `plugin.json` 拆成 `meta.json`（独有字段 + `version`），`build.mjs` 参照现有包改写
4. 包内 `package.json` 只留构建依赖，脚本为 `dev` / `build` / `clean` / `lint` / `format`
5. 新建包内 `cliff.toml`，改 `tag_pattern`、`include_paths` 与 `postprocessors` 的 `<REPO>`
6. 根 `pnpm install`，再跑 `pnpm -r build` 与 `pnpm lint`
7. 在根 `.gitignore` 无需新增规则；在目标仓库初始化 stub（README 重定向 + `.github/ISSUE_TEMPLATE/config.yml`）并提供 `main` 分支
