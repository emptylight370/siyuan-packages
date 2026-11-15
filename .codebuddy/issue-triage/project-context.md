# Issue Triage 项目上下文

> 数据目录：`.codebuddy/issue-triage/`（copy 模式，单副本，project 范围）。跨包规则以仓库根 AGENTS.md 为准。

## 仓库信息

- 仓库：`emptylight370/siyuan-packages`（思源插件 monorepo，SSH remote）
- 默认分支：`main`
- issue 回复语言：中文（仓库文档双语，issue 作者以中文为主；官方自动化回复亦为中英双语）

## issue 标签清单（`gh label list`，2026-11-15）

| 标签               | 说明                                       |
| ------------------ | ------------------------------------------ |
| `accessibility`    | Barrier affecting people with disabilities |
| `bug`              | Something isn't working                    |
| `documentation`    | Improvements or additions to documentation |
| `duplicate`        | This issue or pull request already exists  |
| `enhancement`      | New feature or request                     |
| `good first issue` | Good for newcomers                         |
| `help wanted`      | Extra attention is needed                  |
| `invalid`          | This doesn't seem right                    |
| `question`         | Further information is requested           |
| `wontfix`          | This will not be worked on                 |
| `not template`     | Issue not created from the template        |

- 标注仅可使用本清单内的标签；新建标签须先征得用户同意并更新本清单
- issue 自动化：`issue-open.yml` 在 issue 打开/重开时按正文 checkbox 分流（勾选异常 → `invalid` 并关闭；正常确认 → 自动回复；非模板创建 → `not template` + `help wanted`）。模板位于 `.github/ISSUE_TEMPLATE/`（bug report + feature request 表单，`config.yml` 允许空白 issue——空白 issue 即走「no checkbox」分支）

## 项目约定

- monorepo，跨包规范以仓库根 `AGENTS.md` 为准
- 目录：`packages/plugin/*`（sy-format-helper、siyuan-ignoreeditor、plugin-vscodelite-edit）+ `packages/lib/*`（sy-api、sy-vite-component 内部 lib，各自有 AGENTS.md）
- 质量门禁：`prettier -c .` + `pnpm lint`（oxlint）+ `pnpm -r build`；`tsc --noEmit` 手动执行
- 发布：push tag `<pkg>@<version>` 触发 `release.yml`；lib 不发布集市
- 工具链由 mise 管理；changelog 体系：format-helper 用 `whatschange.md` + `whatschange.old.md`，另两插件用 `changelog.md`

## 变更红线

- `release.yml` 发布流程与 tag 规范；不要本地手动建 release
- `meta.json`（版本唯一来源、禁止出现 name/url）与 `bazaar.json` 元数据契约
- 根级配置独占：包内不得新增 lefthook.yml / .prettierrc / .gitignore / .oxlintrc.json / pnpm-workspace.yaml / pnpm-lock.yaml / mise.lock
- format-helper 手写 `changelog.md` 勿删除或重命名（人工整理的历史记录）
- `sy-api/docs/` 官方文档快照与 `docs/version` 溯源文件

## 关闭策略

手动关：**永不自动关闭 issue**，全部由用户手动处理。agent 可在报告中给出关闭建议（附证据），但不得执行关闭操作。

## 提交策略

完成一轮修复后手动提交：agent 完成代码修改并通过质量门禁后，停在 diff 展示，**不执行 commit**；由用户审阅后自行提交。commit 规范：Conventional Commits，引用 issue 号（供 git-cliff 分组）。

## 用户偏好

- 进度跟踪：启用
- 进度目录：`.codebuddy/issue-triage/progress/`（每 issue 一个文件 `<编号>.md`）
- 初始化日期：2026-11-15
