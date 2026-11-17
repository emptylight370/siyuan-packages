# plugin-vscodelite-edit

思源插件「VSCode Lite Edit」（`plugin-vscodelite-edit`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准。

## 常用命令

| 命令                                                           | 说明                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm install`（仓库根）                                       | 安装全部 workspace 依赖                                                                            |
| `pnpm --filter plugin-vscodelite-edit build`                   | 生产构建，产出 `dist/` 与 `package.zip`                                                            |
| `pnpm --filter plugin-vscodelite-edit dev`                     | vite watch，构建到包内 `dist/`（不压缩），无工作空间写入                                           |
| `mise run //packages/plugin/plugin-vscodelite-edit:build`      | 上述 build 的 mise 任务形式（别名 `node:plugin-vscodelite-edit#build`；`dev`/`clean`/`lint` 同理） |
| `mise run deploy -- -package plugin-vscodelite-edit`           | 构建并把 `dist/` 镜像同步到 `data/plugins/plugin-vscodelite-edit`                                  |
| `mise -C packages/plugin/plugin-vscodelite-edit run changelog` | 由 git-cliff 生成 `changelog.md`                                                                   |

## 架构

配合 **VSCode Lite Edit 主题**使用的插件，由独立仓库迁入 monorepo。构建栈是 **Vite + Vue 3**，部分功能依赖该主题处于启用状态。

**配套主题**：集市包 id 为 **`siyuan-vscodelite-edit`**（类型为 theme，非 plugin），采用 **GPL-3.0** 协议、独立于本 monorepo 分发——见下方「许可边界」。

### 插件生命周期

`src/index.ts` 导出 `PluginVSCE extends Plugin`：

- **`onload()`**：用 `getFrontend()` 与 `location.href` 判定平台，写入 `isMobile` / `isBrowser` / `isLocal` / `isElectron` / `isInWindow` / `platform`，随后 `init(this)`
- **`onunload()`**：调用 `destroy()` 卸载 Vue 实例
- **`openSetting()`**：委托给 `window._sy_plugin_sample.openSetting()`

平台字段在构造函数外赋值，故声明为 `public isMobile!: boolean` 形式的明确赋值断言。

### 模块结构

| 路径                       | 职责                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`             | 插件入口，继承 `Plugin`，负责平台标记与生命周期                                                                              |
| `src/main.ts`              | Vue 初始化：`init(plugin)` 建容器并挂载，`destroy()` 卸载，`usePlugin()` 单例取当前实例                                      |
| ~~`src/api.ts`~~           | 已删除：模板自带的思源 API 封装在本包是**死代码**（无任何调用点）；需要思源 API 时引入 `sy-api` lib（`packages/lib/sy-api`） |
| `src/utils/index.ts`       | `getDomByVueComponent(component)`，把 Vue 组件挂成 DOM                                                                       |
| `src/types/index.d.ts`     | 思源类型（`BlockId`、`NotebookId`、`Block` 等）与 `Window` 接口扩展                                                          |
| `src/types/vue.d.ts`       | `*.vue` 模块声明，供 `tsc` 检查                                                                                              |
| `src/env.d.ts`             | `*.scss` 模块声明                                                                                                            |
| `src/App.vue`              | 根组件（SiyuanTheme 选择器、菜单构建、块菜单处理）                                                                           |
| `sy-vite-component`（lib） | 思源风格基础控件（`SyButton`~`SyTextarea` 全部 6 个），共享 lib：`packages/lib/sy-vite-component`                            |
| `src/i18n/`                | `en_US.json`、`zh_CN.json`（**下划线**命名，与 `plugin.json` 里的 `zh-CN` 键名不同）                                         |

`plugin.json` **不是源文件**：由 `bazaar.json` 的 `types.plugin` 与包内 `meta.json` 经根工厂 `scripts/vite-plugin-config.ts` 的 `resolvePluginMeta()` 合成，再由 `emitPluginJson` 插件写入 `dist/`。

### 构建要点

- `package.json` 的 `build` / `dev` 都是 `vite build`（watch 加 `--watch`），构建编排全部在根 `scripts/vite-plugin-config.ts` 工厂；watch 与 production 一律构建到包内 `dist/`
- 工厂负责静态资源复制（`README*.md`、`icon.png`、`preview.png`、`src/i18n/**` 摊平到 `dist/i18n/`）、元数据合成、生产构建注入 LICENSE banner 并由 `vite-plugin-zip-pack` 打包 `dist/` 为 `package.zip`
- `@` 别名由 `vite-tsconfig-paths` 从包内 `tsconfig.json` 的 `paths` 读取
- 产物含 `dist/index.css`（与 `siyuan-ignoreeditor` 不同，后者样式内联）
- `siyuan` 依赖为 `catalog`（与另两个包一致）

### 关键约定

1. 界面文案统一走 `this.i18n.*`
2. `Window._sy_plugin_sample` 命名空间存放插件对外暴露的接口
3. 主题检测：部分功能仅在 VSCE 主题启用时生效
4. 块属性 `custom-vsce` 记录开关状态
5. `meta.json` 的 `displayName` 只有 `default`，无中文名

## 许可边界（GPL-3.0 主题）

本包许可证为 **MIT**（见 `LICENSE`，© 2026 EmptyLight；代码源自思源官方 MIT 模板，集市上架要求模板版权行改为作者本人）。配套主题 `siyuan-vscodelite-edit` 为 **GPL-3.0**。插件与主题是**独立作品的聚合**（分别打包、分别安装、通过思源运行时交互），GPL 不会传播到本包——但以下边界必须长期守住，违反任意一条都会使本包产物整体 GPL 化、与 MIT 冲突：

1. **零代码复制**：禁止把 GPL 主题的任何源码、样式片段、设计表达复制进本包源码、`sy-vite-component` 控件或仓库内任何 MIT 包
2. **零构建合并**：禁止 import / 打包主题的代码文件（把主题 CSS/SCSS 打进 bundle 即为源码级合并）；运行时按思源挂载路径引用主题文件不受影响
3. **发布独立**：本包与主题始终作为两个独立作品分别打 tag、分别发布 zip；聚合分发（打包在一起但各自附许可与源码指引）合法，合并为单一作品分发不合法
4. **依赖关系不传染**：「本插件专门为该 GPL 主题开发、离开主题无用」不构成衍生（GPL FAQ 明确），无需因此改变本包许可

主题的运行时交互（读取主题状态、适配主题样式约定等）属于聚合层面的正常通信，不触碰上述任何一条。
