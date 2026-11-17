# sy-api

思源 API 封装 + 思源基础全局类型的内部共享 lib。跨包规则以仓库根 `AGENTS.md` 为准。

## 定位与边界

- 不发布集市，无 `meta.json` / `cliff.toml`；以 `workspace:*` 源码级打进插件产物（vite 消费链路验证）
- 许可证 **MIT**（`LICENSE`，© 2024-2026 EmptyLight）；`package.json` 为 `private: true`，不发布 npm
- **与框架无关**：仅依赖 `siyuan` SDK（`fetchSyncPost` / `Lute`）与浏览器 API，任何思源插件渲染进程可用；不适用于内核侧（kernel.js）
- 不做独立 tsc 检查，类型由消费方工程覆盖

## 结构

| 路径                    | 职责                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api.ts`            | API 函数实现，按内核功能分区（Notebook / FileTree / Asset / Block / Attributes / SQL / Template / File / Export / Convert / Notification / Network / System / Lute），顶部仅保留思源 API 文档链接 |
| `src/types/api.d.ts`    | `IRes*` 返回类型的 ambient 声明（`export {} + declare global` 模块化形态）                                                                                                                        |
| `src/types/siyuan.d.ts` | 思源基础全局类型（`BlockId` / `Notebook` / `Block` / `SyFrontendTypes` 等，同样 `declare global`）                                                                                                |
| `src/index.ts`          | 两个 .d.ts 的类型导入入口 + `export * from './api'`                                                                                                                                               |
| `docs/`                 | 官方 API 文档快照（`API.md` / `API.zh-CN.md`）与 `version` 溯源文件                                                                                                                               |

## 关键约定

1. **私有 `request`**：统一请求封装（`code === 0` 才返回 `data`），不导出；新函数一律走它并注解响应类型
2. **重名以模板版为准**：历史合并时 `getBlockKramdown` / `updateBlock(dataType, ...)` / `pushMsg` / `currentTime` 等保留了模板签名，format-helper 旧签名（`getKramdown` / `sendMessage` / `sendError` / `getCurrentTime`）已去重
3. **两个内部接口警示**：`getDom`（getBlockDOM）与 `updateBlockTransactions`（/api/transactions）未列入官方公开 API，官方明示无兼容性保证，函数上方有注释
4. **Lute 转换是同步函数**（`DOM2MD` / `MD2DOM` 等）：纯内存转换非网络请求，不要包装成 async
5. **类型声明必须模块化**：`export {} + declare global`，经 `import type {}` 进入消费方程序；**禁止三斜线引用**（oxlint 的 `typescript/triple-slash-reference` 规则）
6. `mise.toml` 的 `[tasks.changelog] run = ""` 为占位任务（lefthook 要求），勿删

## 新增 API 的步骤

1. `src/api.ts` 按功能分区追加，风格对齐现有函数：私有 `request` + 命令常量内联 + 响应类型注解
2. 响应结构在 `src/types/api.d.ts` 补 `IRes*` 接口（对照 `docs/API.md` 的 Return value 段）
3. 确认端点是否在官方文档有专门章节——未收录的属内核内部接口，须加警示注释
4. 验证：`pnpm lint` + 任一消费方 `tsc --noEmit` + `pnpm -r build`

## 文档快照更新

思源升级后重新对齐：`Invoke-WebRequest` 下载 `siyuan-note/siyuan` 仓库 `docs/API.md` 与 `docs/API.zh-CN.md` 覆盖 `docs/` 下同名文件 → 更新 `docs/version`（版本号 + commit + 日期）→ 比对 `src/api.ts` 端点与文档差异并补全。
