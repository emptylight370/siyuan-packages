# **插件包名**

TODO：一句话定位。跨包规则以仓库根 `AGENTS.md` 与 `docs/agents/` 为准。

## 构建栈

- vite 转发根工厂 `scripts/vite-plugin-config.ts`（`vite.config.ts` 只传 `pkgDir` 与 deps，import 工厂必须带 `.ts` 扩展名）
- 产物在包内 `dist/`（含 `plugin.json`、zip）；调试走根 `deploy` 任务；质量门禁 `pnpm lint` / `pnpm -r build` / `pnpm exec tsc --noEmit -p tsconfig.json`
- `cliff.toml` 的 `tag_pattern` / `include_paths` 与 `mise.toml` 的 changelog 任务为发版支撑，见 `docs/agents/release.md`

## 模块职责

| 路径           | 职责                                                              |
| -------------- | ----------------------------------------------------------------- |
| `src/index.ts` | 插件类：平台标志、生命周期（onload/onunload → main.init/destroy） |
| `src/main.ts`  | `usePlugin` 单例与 Vue 应用挂载/卸载                              |
| `src/App.vue`  | Vue 应用根组件（业务入口）                                        |
| `src/types/`   | `index.d.ts` 包级 `Window` 扩展；`vue.d.ts` SFC 模块声明          |
| `src/utils/`   | Vue 组件转 DOM 等挂载工具                                         |
| `src/i18n/`    | 思源 i18n（文件名下划线 `zh_CN.json`，meta 多语言键横线）         |

## 隐性约定

1. 思源 API 一律走 `sy-api` lib，不写本地 api.ts；UI 控件走 `sy-vite-component`
2. `version` 由 pre-commit `syncversion.ps1` 对齐，不要手改 `package.json` / `meta.json` 的 version
3. TODO：本包业务侧的隐性约定，随开发补记
