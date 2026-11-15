# 元数据

## 三层模型（最需要注意的部分）

完整元数据不以源文件形式存在，而是构建时合成：

| 层   | 文件                                       | 内容                                                                                    |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| 模板 | `bazaar.json`                              | `owner` + `types.<type>` 段，放跨包通用字段（author、backends、readme 默认名、funding） |
| 差异 | `packages/<type>/<pkg>/meta.json`          | 包独有字段（`icon` / `preview` 可选声明），`version` 是唯一版本来源                     |
| 产物 | `<outDir>/<type>.json`（即 `plugin.json`） | 合并结果，进 `package.zip`                                                              |

`scripts/plugin-meta.ts` 的 `resolvePluginMeta()` 负责：`bazaar.types[type]` 与 `meta.json` 深合并（对象递归、数组整体替换）→ `${owner}/${name}/${version}` 占位符替换 → 派生 `name`（目录名）、`url`（`https://github.com/<owner>/<name>`）、`version` → 校验。构建脚本（`build-plugin.ts` / vite 工厂）与 `check-packages.ts` 共用同一实现，标准不会分叉。

规则：`meta.json` **禁止**出现 `name` / `url`（构建期派生，出现即报错）；9 个必填字段缺失即失败（`minAppVersion` 非必填——集市缺省视为全版本适用，仅推荐填写，`pnpm check` 会对缺失给警告；`icon` / `preview` 亦非必填，声明了才校验资源存在）；已声明的 `readme` / `icon` / `preview` / `publish.resources` 必须在产物目录存在；环境变量 `TAG_VERSION` 存在时必须等于 `meta.version`。

## 特性版本门槛记录

以下特性对宿主思源版本有要求，来源是官方示例 `siyuan-note/plugin-sample` 的 README 与 `docs/PLUGIN-PUBLISH.md`。使用这些特性的包需要相应抬高 `minAppVersion`。目前 `pnpm check` 只强制前两条，其余仅记录、未实现检查：

| 特性                                                                                  | 版本门槛                       | 检查状态              |
| ------------------------------------------------------------------------------------- | ------------------------------ | --------------------- |
| `publish.resources` **目录形式**（以 `/` 结尾的条目；文件形式无要求）                 | `3.8.6+`                       | ✅ 已实现（错误拦截） |
| `settingsWindow: true`（桌面端独立设置窗口）                                          | `3.8.7+`                       | ✅ 已实现（错误拦截） |
| 发布服务整体（`publish` / `disabledInPublish` 字段）                                  | `3.8.x` 引入（精确版本未查证） | 仅记录                |
| `siyuan` SDK 的发布快照方法（loadPluginPublishData 等运行时行为；1.2.9 起有类型声明） | `3.8.4+`                       | 仅记录                |

`minAppVersion` 本身非必填（缺省视为全版本适用），但使用上表特性的包必须声明且达到门槛；新增使用这些特性的字段前先核对本表，发现新的隐性版本要求时补充进表。

## 元数据字段校验

集市规则的校验由 `pnpm check`（`scripts/check-packages.ts`）承担，pre-commit 由 lefthook 触发，也可手动在仓库根运行。规则来源是 `siyuan-note/plugin-sample` 的 README 与 `plugin.json`（0.5.2）以及集市规则（`siyuan-note/bazaar` 的 `rules/`）。**不构建**，全量校验各发布包（`packages/*/*` 下含 `meta.json` 的目录）的静态契约；构建期校验（TAG_VERSION 一致性、输出目录资源）仍由 `build-plugin.ts` 负责。

| 检测项                        | 规则                                                                                                                                                                        | 来源                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 清单与资源                    | 复用 `resolvePluginMeta`：目录层级、`bazaar.json` `owner`/`types`、`meta.json` 禁止 `name`/`url`、9 个必填字段、已声明的 `readme`/`icon`/`preview`/`publish.resources` 存在 | 与构建期同一套                |
| `version`                     | semver 且无 `v` 前缀（集市规范）                                                                                                                                            | `siyuan-note/bazaar` `rules/` |
| `displayName` / `description` | 必须有 `default` 文案（集市以 default 兜底）                                                                                                                                | `plugin-sample` README        |
| `backends` / `frontends`      | 合并后非空数组                                                                                                                                                              | `plugin-sample` README        |
| 包名一致性                    | `package.json` `name` 与目录名一致（目录名同时是插件名、产物 `name`、发布仓库名）                                                                                           | 本仓库约定                    |
| `minAppVersion`               | 非必填（缺省视为全版本适用），缺失仅警告                                                                                                                                    | 集市规则                      |
| 版本联动                      | `settingsWindow: true` 需 `minAppVersion >= 3.8.7`；`publish.resources` 含目录声明需 `>= 3.8.6`（见上表）                                                                   | `plugin-sample` README        |
| 主题 `modes`                  | 仅允许 `light` / `dark`（当前无 theme 包，保留规则备用）                                                                                                                    | `plugin-sample` README        |

可选字段 `kernels`（仅含 `kernel.js` 时需要）、`bootAppearances` 当前未声明，属按需状态；`publish`（`publish.resources` 目录形式）与 `settingsWindow` 已有实际使用者——两个 `siyuan-ttf-*` 字体包（`publish.resources: ["fonts/"]`、`settingsWindow: true`，`minAppVersion` 3.8.7 同时满足两条门槛）。

**警告不拦截、错误 exit 1**。产物级集市限制（`icon` ≤ 64 KiB、`preview` ≤ 512 KiB、不支持 SVG，建议 160×160 / 1024×768）当前**没有自动检查**，来源是 `plugin-sample` README，产物异常时对照官方文档人工核。
