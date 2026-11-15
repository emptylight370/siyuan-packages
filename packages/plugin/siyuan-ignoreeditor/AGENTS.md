# siyuan-ignoreeditor

思源插件「忽略文件编辑器」（`siyuan-ignoreeditor`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准。

## 常用命令

| 命令                                                        | 说明                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm install`（仓库根）                                    | 安装全部 workspace 依赖                                                                         |
| `pnpm --filter siyuan-ignoreeditor build`                   | 生产构建，产出 `dist/` 与 `package.zip`                                                         |
| `pnpm --filter siyuan-ignoreeditor dev`                     | vite watch，输出到 `VITE_SIYUAN_WORKSPACE_PATH` 指向的插件目录                                  |
| `mise run //packages/plugin/siyuan-ignoreeditor:build`      | 上述 build 的 mise 任务形式（别名 `node:siyuan-ignoreeditor#build`；`dev`/`clean`/`lint` 同理） |
| `mise run deploy -- -package siyuan-ignoreeditor`           | 构建并把 `dist/` 镜像同步到 `data/plugins/siyuan-ignoreeditor`                                  |
| `mise -C packages/plugin/siyuan-ignoreeditor run changelog` | 由 git-cliff 生成 `whatschange.md`                                                              |

## 架构

用于编辑思源内置忽略文件的界面插件。构建栈是 **Vite + Vue 3**（与 `sy-format-helper` 的 esbuild 不同）。

### 插件生命周期

`src/index.ts` 导出 `IgnoreEditor extends Plugin`：

- **`onload()`**：用 `getFrontend()` 与 `location.href` 判定平台，写入 `isMobile` / `isBrowser` / `isLocal` / `isElectron` / `isInWindow` / `platform`，随后 `init(this)`
- **`onunload()`**：调用 `destroy()` 卸载 Vue 实例
- **`openSetting()`**：委托给 `window._plugin_ignore_editor.openSetting()`

平台字段在构造函数外赋值，故声明为 `public isMobile!: boolean` 形式的明确赋值断言。

### 模块结构

| 路径                   | 职责                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `src/index.ts`         | 插件入口，继承 `Plugin`，负责平台标记与生命周期                                      |
| `src/main.ts`          | Vue 初始化：`init(plugin)` 建容器并挂载，`destroy()` 卸载，`usePlugin()` 单例        |
| `src/App.vue`          | 根组件                                                                               |
| `src/SettingPage.vue`  | 设置面板                                                                             |
| `src/api.ts`           | 思源 API 封装（`fetchSyncPost`）                                                     |
| `src/utils/index.ts`   | `getDomByVueComponent(component)`，把 Vue 组件挂成 DOM                               |
| `src/types/index.d.ts` | 思源类型与 `Window` 扩展，含 `_plugin_ignore_editor` 命名空间                        |
| `src/types/vue.d.ts`   | `*.vue` 模块声明，供 `tsc` 检查                                                      |
| `src/env.d.ts`         | `*.scss` 模块声明                                                                    |
| `src/components/`      | 按功能拆分的 Vue 组件，含 `SiyuanTheme/` 下的基础控件                                |
| `src/i18n/`            | `en_US.json`、`zh_CN.json`（**下划线**命名，与 `plugin.json` 里的 `zh-CN` 键名不同） |

`plugin.json` **不是源文件**：由 `bazaar.json` 的 `types.plugin` 与包内 `meta.json` 经 `scripts/plugin-meta.mjs` 的 `resolvePluginMeta()` 合成，再由 `vite.config.ts` 的 `emitPluginJson` 插件写入 `dist/`。

### 构建要点

- `vite.config.ts` 顶层 `await resolvePluginMeta({ pkgDir: __dirname })` 取合并后的元数据
- `viteStaticCopy` 复制 `README*.md`、`icon.png`、`preview.png`、`src/i18n/**`（`stripBase: 2` 摊平到 `dist/i18n/`）
- 生产构建由 `vite-plugin-zip-pack` 打包 `dist/` 为 `package.zip`
- **样式全部内联进 `index.js`**，`dist/` 里没有 `index.css`（`sy-format-helper` 与 `plugin-vscodelite-edit` 都有）
- `siyuan` 依赖为 `^1.3.0`（与另两个包一致）

### 关键约定

1. 界面文案统一走 `this.i18n.*`
2. `Window._plugin_ignore_editor` 命名空间存放插件对外暴露的接口
3. `meta.json` 的 `displayName` 同时有 `default` 与 `zh-CN`
4. 代码源自 VSCE 插件，类名已改为 `IgnoreEditor`（业务为忽略文件编辑）
