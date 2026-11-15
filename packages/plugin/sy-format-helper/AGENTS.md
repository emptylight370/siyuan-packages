# sy-format-helper

思源插件「格式助手」（`sy-format-helper`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准。

## 常用命令

| 命令                                                     | 说明                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm install`（仓库根）                                 | 安装全部 workspace 依赖                                                                      |
| `pnpm --filter sy-format-helper build`                   | 生产构建，产出 `dist/` 与 `package.zip`                                                      |
| `pnpm --filter sy-format-helper dev`                     | esbuild watch，产物写到包根，便于软链到思源插件目录调试                                      |
| `mise run //packages/plugin/sy-format-helper:build`      | 上述 build 的 mise 任务形式（别名 `node:sy-format-helper#build`；`dev`/`clean`/`lint` 同理） |
| `mise run deploy -- -package sy-format-helper`           | 构建并把 `dist/` 镜像同步到 `data/plugins/sy-format-helper`                                  |
| `mise -C packages/plugin/sy-format-helper run changelog` | 由 git-cliff 生成 `whatschange.md`                                                           |

## 架构

格式化文本块的插件。构建栈是 **esbuild**（根 `scripts/build-plugin.mjs`），包内没有 `vite.config.ts`。

### 插件生命周期

`src/index.ts` 导出 `FormatHelper extends Plugin`：

- **`onload()`**：注册文本块图标菜单监听
- **`onunload()`**：用保存的引用 `off` 掉监听
- **`addTextBlockItem({ detail })`**：在文本块图标菜单里注入子菜单项

### 模块结构

| 路径                                      | 职责                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `src/index.ts`                            | `FormatHelper` 主体，菜单注入与批量处理入口                            |
| `src/api.ts`                              | 思源 API 封装，用到 `getDom`、`updateBlockTransactions` 等             |
| `src/index.scss`                          | 样式源码，经 sass 编译为 `dist/index.css`                              |
| `src/env.d.ts`                            | `*.scss` 模块声明                                                      |
| `src/i18n/en.json`、`src/i18n/zh-CN.json` | 语言文件，**横线**命名（另两个 vite 包用 `en_US.json` / `zh_CN.json`） |

`src/index.ts` 内部结构：

| 成员                                                        | 作用                                       |
| ----------------------------------------------------------- | ------------------------------------------ |
| `processTextBlocks(blockElements, protyle, type)`           | 批量处理入口                               |
| `handleTextBlock(blockId, protyle, type)`                   | 处理单个块，返回是否产生改动               |
| `commitUpdatedBlock(protyle, blockId, newElement, oldHTML)` | 把改动写回块内容                           |
| `textMappers`                                               | 按 `type` 取对应文本变换函数的映射表       |
| `skippedInlineTypes` / `isInSkippedInline`                  | 跳过不该被改写的行内元素类型               |
| `applyTextTransform(doc, type)`                             | 在 DOM 上应用变换                          |
| `handleCodeBlock` / `codeBlockDecline` / `codeBlockRise`    | 代码块缩进与反缩进，**当前被抑制**（见下） |

### 构建要点

- `package.json` 的 `build` / `dev` 都转发到 `node ../../../scripts/build-plugin.mjs`，包内没有构建实现
- 构建脚本先 `copyAssets`（README、`icon.png`、`preview.png`、`src/i18n/**`），再用 `resolvePluginMeta` 合成 `plugin.json`，最后 esbuild 打包并在生产模式注入 LICENSE banner
- sass 通过自定义 esbuild 插件编译，产物为 `dist/index.css` 与 `dist/index.js`
- `whatschange.old.md` 是 0.7.1 及更早的历史存档，`changelog` 任务会把它追加到 `whatschange.md` 末尾，**不要删除或重命名**

### 关键约定

1. 菜单文案统一走 `this.i18n.*`
2. `private processing` 防重复点击：上一次批量处理未结束时忽略新的触发
3. `onBlockIcon` 保存 `bind` 后的引用，`off` 必须传入同一引用才能移除监听
4. 代码块操作目前处于抑制状态（`newDom` 被置空后直接提示「无变化」），恢复前先确认产品决策
