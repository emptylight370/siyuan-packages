# sy-format-helper

思源插件「格式助手」（`sy-format-helper`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准。

## 常用命令

| 命令                                                     | 说明                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm install`（仓库根）                                 | 安装全部 workspace 依赖                                                                      |
| `pnpm --filter sy-format-helper build`                   | 生产构建，产出 `dist/` 与 `package.zip`                                                      |
| `pnpm --filter sy-format-helper dev`                     | vite watch，构建到包内 `dist/`（不压缩），调试走根 `deploy` 任务                             |
| `mise run //packages/plugin/sy-format-helper:build`      | 上述 build 的 mise 任务形式（别名 `node:sy-format-helper#build`；`dev`/`clean`/`lint` 同理） |
| `mise run deploy -- -package sy-format-helper`           | 构建并把 `dist/` 镜像同步到 `data/plugins/sy-format-helper`                                  |
| `mise -C packages/plugin/sy-format-helper run changelog` | 由 git-cliff 生成 `whatschange.md`                                                           |

## 架构

格式化文本块的插件。构建栈是 **Vite**（包内 `vite.config.ts` 转发根 `scripts/vite-plugin-config.ts` 工厂）。

### 插件生命周期

`src/index.ts` 导出 `FormatHelper extends Plugin`：

- **`onload()`**：注册文本块图标菜单监听
- **`onunload()`**：用保存的引用 `off` 掉监听
- **`addTextBlockItem({ detail })`**：在文本块图标菜单里注入子菜单项

### 模块结构

| 路径                                      | 职责                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`                            | `FormatHelper` 主体，菜单注入与批量处理入口                                                    |
| `src/index.scss`                          | 样式源码，经 sass 编译为 `dist/index.css`                                                      |
| `changelog.md`                            | **手写**历史 changelog（v0.7.1 及更早的人工整理记录），与 whatschange 体系并行，勿删除或重命名 |
| `src/env.d.ts`                            | `*.scss` 模块声明                                                                              |
| `src/i18n/en.json`、`src/i18n/zh-CN.json` | 语言文件，**横线**命名（另两个 vite 包用 `en_US.json` / `zh_CN.json`）                         |

`src/index.ts` 内部结构：

| 成员                                                     | 作用                                                                                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `processTextBlocks(blockElements, protyle, type)`        | 批量处理入口：直接改写编辑器 DOM（eventBus 回调现成的 `detail.blockElements`，**不经 API 取块**），单次 `transaction` 提交全部选中块（官方 plugin-sample `removeSpace` 模式，一次 undo 整体回滚） |
| `textMappers`                                            | 按 `type` 取对应文本变换函数的映射表                                                                                                                                                              |
| `skippedInlineTypes` / `isInSkippedInline`               | 跳过不该被改写的行内元素类型                                                                                                                                                                      |
| `applyTextTransform(blockElement, type)`                 | 在编辑器块元素（含嵌套子块）上应用变换，返回是否实际修改                                                                                                                                          |
| `handleCodeBlock` / `codeBlockDecline` / `codeBlockRise` | 代码块缩进与反缩进：已迁移到 eventBus `detail`（在块副本上改写，不经 API），**功能保持抑制**——改写结果被丢弃、不提交事务（见下）                                                                  |

### 构建要点

- `package.json` 的 `build` / `dev` 都是 `vite build`（watch 加 `--watch`），构建编排全部在根 `scripts/vite-plugin-config.ts` 工厂
- 工厂负责静态资源复制（README、`icon.png`、`preview.png`、`src/i18n/**`）、`resolvePluginMeta` 合成 `plugin.json`、生产构建注入 LICENSE banner 与打 `package.zip`
- SCSS 由 vite 内置 sass 编译，产物为 `dist/index.css` 与 `dist/index.js`
- `whatschange.old.md` 是 0.7.1 及更早的历史存档，`changelog` 任务会把它追加到 `whatschange.md` 末尾，**不要删除或重命名**

### 关键约定

1. 菜单文案统一走 `this.i18n.*`
2. `private processing` 防重复点击：上一次批量处理未结束时忽略新的触发
3. `onBlockIcon` 保存 `bind` 后的引用，`off` 必须传入同一引用才能移除监听
4. 代码块操作保持抑制：点击仅提示「无变化」，改写在块副本上完成后即丢弃；恢复产品决策时改为 `transaction` 提交改写后的 `doc.body.firstElementChild.outerHTML`（参照 `processTextBlocks`）
5. 本包不再依赖 `sy-api` lib（文本与代码块流程均已迁移到编辑器 DOM + 事务提交）
