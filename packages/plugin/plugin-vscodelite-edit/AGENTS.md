# plugin-vscodelite-edit

思源插件「VSCode Lite Edit」（`plugin-vscodelite-edit`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准。

## 常用命令

| 命令                                                           | 说明                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm install`（仓库根）                                       | 安装全部 workspace 依赖                                           |
| `pnpm --filter plugin-vscodelite-edit build`                   | 生产构建，产出 `dist/` 与 `package.zip`                           |
| `pnpm --filter plugin-vscodelite-edit dev`                     | vite watch，输出到 `VITE_SIYUAN_WORKSPACE_PATH` 指向的插件目录    |
| `mise run deploy -- -package plugin-vscodelite-edit`           | 构建并把 `dist/` 镜像同步到 `data/plugins/plugin-vscodelite-edit` |
| `mise -C packages/plugin/plugin-vscodelite-edit run changelog` | 由 git-cliff 生成 `whatschange.md`                                |

## 架构

配合 VSCode Lite Edit 主题使用的插件，由独立仓库迁入 monorepo。构建栈是 **Vite + Vue 3**，部分功能依赖该主题处于启用状态。

### 插件生命周期

`src/index.ts` 导出 `PluginVSCE extends Plugin`：

- **`onload()`**：用 `getFrontend()` 与 `location.href` 判定平台，写入 `isMobile` / `isBrowser` / `isLocal` / `isElectron` / `isInWindow` / `platform`，随后 `init(this)`
- **`onunload()`**：调用 `destroy()` 卸载 Vue 实例
- **`openSetting()`**：委托给 `window._sy_plugin_sample.openSetting()`

平台字段在构造函数外赋值，故声明为 `public isMobile!: boolean` 形式的明确赋值断言。

### 模块结构

| 路径                   | 职责                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `src/index.ts`         | 插件入口，继承 `Plugin`，负责平台标记与生命周期                                                   |
| `src/main.ts`          | Vue 初始化：`init(plugin)` 建容器并挂载，`destroy()` 卸载，`usePlugin()` 单例取当前实例           |
| `src/api.ts`           | 思源 API 封装（`fetchSyncPost`），覆盖笔记本、文件树、块、属性、SQL、模板、导出、通知、网络、系统 |
| `src/utils/index.ts`   | `getDomByVueComponent(component)`，把 Vue 组件挂成 DOM                                            |
| `src/types/index.d.ts` | 思源类型（`BlockId`、`NotebookId`、`Block` 等）与 `Window` 接口扩展                               |
| `src/types/vue.d.ts`   | `*.vue` 模块声明，供 `tsc` 检查                                                                   |
| `src/env.d.ts`         | `*.scss` 模块声明                                                                                 |
| `src/App.vue`          | 根组件（SiyuanTheme 选择器、菜单构建、块菜单处理）                                                |
| `src/components/`      | 按功能拆分的 Vue 组件，含 `SiyuanTheme/` 下的基础控件                                             |
| `src/i18n/`            | `en_US.json`、`zh_CN.json`（**下划线**命名，与 `plugin.json` 里的 `zh-CN` 键名不同）              |

`plugin.json` **不是源文件**：由 `bazaar.json` 的 `types.plugin` 与包内 `meta.json` 经 `scripts/plugin-meta.mjs` 的 `resolvePluginMeta()` 合成，再由 `vite.config.ts` 的 `emitPluginJson` 插件写入 `dist/`。

### 构建要点

- `vite.config.ts` 顶层 `await resolvePluginMeta({ pkgDir: __dirname })` 取合并后的元数据，其中 `name` 用于 dev 输出路径
- `viteStaticCopy` 复制 `README*.md`、`icon.png`、`preview.png`、`src/i18n/**`（`stripBase: 2` 摊平到 `dist/i18n/`）
- 生产构建由 `vite-plugin-zip-pack` 打包 `dist/` 为 `package.zip`
- 产物含 `dist/index.css`（与 `siyuan-ignoreeditor` 不同，后者样式内联）
- `siyuan` 依赖固定在 `1.2.6`，低于其他两个包，升级前先确认 API 差异

### 关键约定

1. 界面文案统一走 `this.i18n.*`
2. `Window._sy_plugin_sample` 命名空间存放插件对外暴露的接口
3. 主题检测：部分功能仅在 VSCE 主题启用时生效
4. 块属性 `custom-vsce` 记录开关状态
5. `meta.json` 的 `displayName` 只有 `default`，无中文名
