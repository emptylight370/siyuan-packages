**简体中文**
| [English](CONTRIBUTING.en.md)

# 贡献指南

本仓库是一个 **pnpm monorepo**，包含多个思源笔记集市插件（`packages/plugin/*`）与内部共享库（`packages/lib/*`）。插件包的构建已统一为 vite（根 `scripts/vite-plugin-config.ts` 工厂），产物落在包内 `dist/`。

## 仓库结构

```
packages/
├── plugin/<包名>/          # 集市插件包（各自独立发布）
└── lib/<库名>/             # 内部共享库（源码级打进插件产物，不发布）
scripts/                    # 构建工厂与仓库级脚本（维护者层）
bazaar.json                 # 各插件包的集市元数据模板（name/url/author 等派生来源）
docs/agents/                # 构建与发布流程的详细说明
```

## 如何在本地进行开发

1. 复刻本仓库到自己的仓库
2. 克隆仓库到本地
3. 安装 mise-en-place 工具
4. 通过 mise 安装工具，如 node、pnpm 等（`mise install`）
5. 通过 pnpm 安装依赖，或运行 `mise deps install` 命令
6. 初始化 lefthook，运行 `lefthook install`，如已运行 `mise deps install` 则已完成
7. 在本地修改代码
8. 运行 `pnpm --filter <包名> build` 编译单个包，或 `pnpm build`（即 `pnpm -r build`）编译全部包
9. 部署集市包到思源笔记进行调试：`mise run deploy -- -package <package_name>`（注意 `--`，其后参数才传给脚本）；可通过 `-target <工作空间名>` 指定工作空间，或 `-all` 部署到所有工作空间
10. 部署后刷新思源，在 `思源 - 设置 - 集市` 中确认插件生效

如不使用 mise，可自行安装项目中列出的依赖，并进行开发。

## 质量门禁

提交前必须全过以下检查（在仓库根运行）：

| 命令                      | 检查内容                        |
| ------------------------- | ------------------------------- |
| `pnpm build`              | 全部包构建成功                  |
| `pnpm lint`               | oxlint 静态检查                 |
| `pnpm exec prettier -c .` | 代码风格                        |
| `pnpm check`              | 各包 `meta.json` 与集市契约校验 |
| `pnpm typecheck`          | 仓库级脚本类型检查              |

有 `.vue` 源码的包（`siyuan-ignoreeditor`、`plugin-vscodelite-edit`）还需通过包内 `pnpm exec tsc --noEmit -p tsconfig.json`。

## 改动范围约定

1. 单个 pull request 应当聚焦单个包或共享库的功能改进或缺陷修复；如需同时修改多个包或共享库，应分开提交
2. 只改包内源码时无需动基础设施层；涉及 `scripts/`、`bazaar.json`、根工作流等共享层的变更，请先开 issue 讨论
3. **不要手改 `plugin.json`**——它是由 `bazaar.json` 模板与包内 `meta.json` 合成的构建产物；版本号在 `meta.json` 中维护，`package.json` 的版本由 pre-commit 钩子自动同步
4. 修改包行为时同步更新该包的 `AGENTS.md`（包级约定）

## 提交与拉取请求规范

1. 为功能或缺陷提交 issue（请使用 issue 模板：标题需按提示改写，检查清单如实勾选——勾选「闭眼全选」确认项的议题会被 CI 自动关闭）
2. 为功能或缺陷提交 pull request
3. 提交信息必须符合 Conventional Commits 规范（`feat:` / `fix:` / `chore:` 等）——changelog 由 git-cliff 依据提交信息自动生成
4. 提交代码必须通过质量检查，包括 `pnpm run lint`、`pnpm run format`、`pnpm run check`、`pnpm run typecheck` 等
5. 如向本仓库贡献代码，则同意使用对应包或共享库所使用许可证授权代码，并同意后续因任何原因在未单独通知情况下以任意许可证重新授权代码。在贡献代码时不因此修改导致对应包或共享库的许可证发生变化

## 相关文档

| 文档                                | 内容                                |
| ----------------------------------- | ----------------------------------- |
| 根 `AGENTS.md`                      | 仓库快照、常用命令、AI 协作约定     |
| `docs/agents/build.md`              | 构建流程、打包内容、LICENSE 注入    |
| `docs/agents/release.md`            | 版本发布与 changelog 机制（维护者） |
| `docs/agents/new-package.md`        | 新增包的两种路线                    |
| 包内 `AGENTS.md` 与 `CONTRIBUTE.md` | 各包的包级约定与贡献步骤            |
