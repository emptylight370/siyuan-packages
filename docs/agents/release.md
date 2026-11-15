# 发布

## tag 创建与推送

发布靠 push tag 触发 CI，不要在本地手动建 release。tag 由根任务统一创建（扫描 `packages/*/*/meta.json`，tag 已存在或版本未变则跳过）：

```bash
mise run tag
git push origin "sy-format-helper@0.7.2"   # 推送 tag 触发 CI 发布
```

仓库配置了 `tag.gpgSign = true`，任务内部用 `git tag -a <tag> -m ''` 创建空消息 annotated tag；不要用裸 `git tag <name>`，它会打开编辑器并失败。

## 本地发布任务

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

## 发布流水线

`.github/workflows/release.yml` 由 tag push（`*@*`）触发，也可 `workflow_dispatch` 手动补发：

1. `scripts/parse-tag.ts` 解析 `<pkg>@<version>`，扫描 `packages/*/<pkg>` 要求**恰好命中 1 个**目录，输出 `name/version/meta_version/matched/reason/type/dir/owner`。`packages` 目录或 `meta.json` 缺失（迁移前提交、旧版本 tag）、`meta.json.version` 与 tag 不一致时输出 `matched=false`；tag 格式错误、包目录匹配数不为 1、`bazaar.json` 结构缺失仍然中断。
2. `Check whether to release` 汇总跳过条件（`matched=false`，或 `gh release view` 显示目标仓库已有该版本），输出 `skip`。其中 `release not found|HTTP 404` 视为未发布，其他错误（如 `RELEASE_TOKEN` 无效）直接失败。后续所有步骤条件统一为 `if: steps.state.outputs.skip != 'true'`。
3. `pnpm --filter <pkg> build`，`TAG_VERSION` 传入以在构建期再校验一次版本。
4. `git cliff --config <pkg>/cliff.toml --latest -o release.md` 生成 release notes。
5. `jq-action` 读取**产物** `dist/plugin.json` 的 `version`，与 tag 版本比对；最终 `tag_name` 取自产物而非 tag，保证与集市读到的版本同源。
6. `Sync metadata to target repo`：把 `dist/` 下的 `plugin.json`、`icon.png`、`preview.png` 提交并推送到目标仓库 `main`，使下一步以 `target_commitish: main` 创建的 tag 指向这份含元数据的提交（checkout tag 即可看到完整元数据与图标）。带 `continue-on-error: true`，失败只告警不影响发布；`git status --porcelain` 为空时跳过提交；提交身份取仓库变量 `vars.COMMIT_NAME` / `vars.COMMIT_EMAIL`。
7. `softprops/action-gh-release` 通过 `repository: <owner>/<pkg>` + `token: secrets.RELEASE_TOKEN` 发布到独立仓库，`target_commitish: main`，`fail_on_unmatched_files: true`。

子仓库的 tag 是**裸版本号**（`0.7.1`），不给 `v` 前缀也不带包名；monorepo 的 tag 才是 `<pkg>@<version>`。跨仓发布必须用 PAT 或 GitHub App token（`GITHUB_TOKEN` 只能作用于本仓库），且目标仓库必须已有 `main` 分支（stub 初始化）。

**单次运行只处理 1 个包**：`parse-tag.ts` 一次只解析一个 tag，且要求 `packages/*/<pkg>` 恰好命中 1 个目录；工作流是单 job、没有 `strategy.matrix`，`workflow_dispatch` 的 `inputs.tag` 也只有一个字符串。多包发布需推多个 tag，由 GitHub 为每个 tag 各自创建一次运行并行执行（`concurrency.group = release-<tag>` 按 tag 隔离：同 tag 排队不并行，不同 tag 完全并行）。因此每次运行都会重复 `checkout --fetch-depth 0` 与 `pnpm install --frozen-lockfile`，发 N 个包就有 N 次重复开销，只有 `pnpm --filter <pkg> build` 是单包范围。若要一次运行处理多包，需改成 matrix（拆分 `inputs.tags` 为列表）或加 pnpm store 缓存压低重复成本。

## changelog 配置

每个包一份 `cliff.toml`，其中两项**必须逐包修改**：

```toml
[git]
tag_pattern = "^<pkg>@"                              # 只用本包 tag 作为版本锚点
include_paths = ["packages/<type>/<pkg>/**"]         # 键名是复数，值为 glob 数组
```

`tag_pattern` 只做筛选、**不会**从 tag 名提取版本号，所以标题用 `version | split(pat="@") | last` 渲染成 `0.7.1`；而 `compare` 链接必须使用**完整 tag 名**（`previous.version` / `version`），因为 monorepo 的 tag 带包名前缀，用裸版本号会 404。`include_paths` 的值必须能匹配到文件层级（`/**` 或带尾斜杠的目录形式），写纯目录会导致所有提交被过滤、cliff 认不出 tag 并退化为 `## [unreleased]`。

`postprocessors` 的 `<REPO>` 指向**当前 monorepo**（`https://github.com/<owner>/siyuan-packages`）：commit 只存在于 monorepo，子仓库不再推送代码。`output` 指向包内 `whatschange.md`，CI 用 `-o release.md` 覆盖输出，不会污染包内文件。

历史版本无法由 cliff 重新生成：`git subtree add` 保留的是原仓库提交对象，它们的 diff 路径是原仓库根（`src/`、`package.json`、`plugin.json`），不匹配 `packages/<type>/<pkg>/**`（实测命中 0），因此历史 tag 全部失效、cliff 只能输出当前版本段落。历史记录保存在 `whatschange.old.md`，由 `changelog` 任务在生成后追加；也正因为如此，**不要在已发布版本上运行 `changelog`**，否则会产生重复段落。

相关文档：格式化与 hooks 的格式化 job 见 [quality.md](./quality.md)；新增包时的 `cliff.toml` 改造步骤见 [new-package.md](./new-package.md)。
