# 思源插件 monorepo

思源（SiYuan）插件 monorepo。每个子包最终都要发布到自己的独立 GitHub 仓库，因为思源集市按「仓库」查找 `tag == version` 的 release 并下载其中的 `package.zip`。

部分包内部有各自的 `AGENTS.md`，只描述该包的架构、命令与隐性约定，改动该包前应先读；跨包规则一律以本文件与 `docs/agents/` 为准，两者冲突时根文件优先。

## 项目快照

| 项       | 当前值                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------- |
| 包组     | `packages/plugin/*`（发布包）、`packages/lib/*`（内部共享 lib，不发布）                                  |
| 模板存档 | `templates/`（plugin-vue 预适配模板；不进 workspace/mise/门禁，新建包路线见 docs/agents/new-package.md） |
| 包管理器 | pnpm（mise 管运行时与 CLI：node / pnpm / prettier / git-cliff / lefthook）                               |
| 构建系统 | 全部包统一 vite：根 `scripts/vite-plugin-config.ts` 工厂 + 包内 `vite.config.ts` 转发，无 Turborepo      |
| 测试     | 无测试框架；质量门禁是 `pnpm lint`、`prettier -c .`、`pnpm check`、`pnpm -r build` 四者                  |

## Context Index

只读当前任务需要的文件：

| 任务                                                    | 读                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| 写代码、过质量门禁                                      | [docs/agents/quality.md](docs/agents/quality.md)                 |
| 查插件 API 用法（生命周期/菜单/命令/Dock/内核等）       | [docs/plugin-sample.md](docs/plugin-sample.md)                   |
| 查 vite-vue 集成与产物合规（Vue 挂载/vite.config 逐段） | [docs/plugin-sample-vite-vue.md](docs/plugin-sample-vite-vue.md) |
| 构建、调试、部署                                        | [docs/agents/build.md](docs/agents/build.md)                     |
| 改 `meta.json` / `bazaar.json`、集市规则、特性版本门槛  | [docs/agents/metadata.md](docs/agents/metadata.md)               |
| 发版、changelog、CI 排查                                | [docs/agents/release.md](docs/agents/release.md)                 |
| 新增包                                                  | [docs/agents/new-package.md](docs/agents/new-package.md)         |
| 找目录/命名/lib/mise/ignore 约定                        | [docs/agents/project.md](docs/agents/project.md)                 |

## 常用命令

```bash
mise install                      # 安装 node / pnpm / prettier / git-cliff / lefthook
pnpm install                      # 安装根与所有 workspace 包的依赖
pnpm -r build                     # 构建全部包（各包 vite 构建，产物在包内 dist/）
pnpm --filter sy-format-helper build   # 单包 production 构建，产出 <pkg>/dist 与 <pkg>/package.zip
pnpm --filter sy-format-helper dev     # vite watch，构建到包内 dist/（调试走 deploy 任务）
pnpm lint                         # oxlint packages
pnpm lint:fix                     # 同上并自动修复
pnpm check                        # 校验各发布包的元数据契约（见 metadata.md）
pnpm typecheck                    # scripts/*.ts 的类型检查
pnpm format                       # prettier -w .（读根 .prettierrc 与 .prettierignore）
pnpm -r clean                     # 删除各包 dist 与 package.zip
mise run //:build                 # 根脚本也导入为 mise 任务（workspace graph），等价 pnpm -r build
mise run //packages/plugin/sy-format-helper:build   # 单包构建（= pnpm --filter sy-format-helper build）
mise run tag                      # 为各包创建本地发布 tag（已存在或版本未变则跳过）
mise run deploy -- -package <pkg> # 构建单包并把 dist 部署到思源工作空间
```

monorepo 模式 + workspace graph 把根与各包的 `package.json` scripts、子包 `.mise/tasks/` 全部导入为 mise 任务：根与包脚本名为 `node:<pkg>#<script>`（根项目 `node:siyuan-packages#build`），同时有路径式别名 `//packages/plugin/<pkg>:<script>`；两者都从仓库根直接可调用，`mise tasks`（包内）/ `mise tasks --all`（根）查看。

## 代理工作流要点

- 不要发明项目里不存在的机制：本仓库没有对应命令、策略或测试套件时，在文档中标 `TODO`，不要现造。
- 改动命令、hooks、包结构、构建产物或代理规则时，**同一变更内**更新 `docs/agents/` 对应文档与本文件快照。
- 声称改动完成前运行相关验证命令并报告确切结果；纯文档改动可写 `N/A (docs only)`。
- 保留工作区的未提交改动，不要回滚或覆盖无关的本地修改。
