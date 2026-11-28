# 实现计划：单张图片处理（暂存）

> 状态：**依赖确认已完成**（两个源码探索代理 + 智能体复核，基于本仓库思源源码，2026-11-28）。结论已并入下文，动工前的剩余核对项见文末。总体设计见 [design.md](./design.md)。批量队列 / emojis 目录 / 整理 / 查重不在本期范围。

## 范围裁剪（阶段划分）

- **阶段一（MVP）**：jsquash 四格式（JPEG 变体 / PNG / 静态 WebP / 静态 AVIF）的单张压缩 + 预览 + 写回；参数使用内置默认值（持久化结构就绪但不做设置 UI）
- **阶段二**：magick-wasm 适配器（静态 GIF / TIFF）、设置界面、批量队列
- **范围外（当前 API 无法覆盖）**：加密笔记本资源——内核对加密 box 一律拒绝 `getFile`/`putFile`（file.go:384-386、704-706，防密文泄漏/明文污染），需内核新增加密感知 API 才可行。MVP 做检测并跳过 + 提示
- 理由：magick-wasm 的 wasm 资产与体积是最大构建风险，MVP 先把「读取 → 压缩 → 预览 → 写回」全链路跑通

## 功能模块清单

按依赖顺序（前 → 后）：

| #   | 模块           | 文件（拟定）                                     | 职责                                                                                                                                                                                                                                                                                                                                     | 依据（已确认）      |
| --- | -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | 格式检测       | `src/core/format.ts`                             | 扩展名归一（JPEG 六变体 → JPEG）+ **magic bytes 全量嗅探**（上传/导入不转换格式、用户改名可致扩展名失真，不能只信扩展名；可参考内核 `mimetype.Detect`）；跳过规则：HEIC/MOV、动画 APNG（`acTL`）/动画 WebP（`ANIM`）/动画 GIF（帧数>1）、BMP/SVG/ICO/CUR、SVG、加密笔记本资源                                                            | 源码核对 #C         |
| 2   | 文件读取       | `src/core/read.ts`                               | 路径解析：取 `data-src` → `getDecodedPath` 解码 → 剥 `?style=thumb` → 识别 `?box=` → 排除 `file://`、盘符等非内核路径 → 映射为**工作空间根基准**的 `/data/...` 路径；裸 fetch `/api/file/getFile` 读原始字节（返回即二进制非 JSON 包装；失败 HTTP **202** + `{code,msg}`，sy-api 现封装不适用）                                          | 源码核对 #B/#D      |
| 3   | 参数模型       | `src/core/settings.ts`                           | 每格式默认参数常量 + `saveData`/`loadData` 持久化结构（带 `schemaVersion`；本期只读默认值）                                                                                                                                                                                                                                              | —                   |
| 4   | 压缩 Worker    | `src/worker/compress.worker.ts`                  | Worker 主体、串行队列、进度/取消消息协议；产物暂存 buffer 传出                                                                                                                                                                                                                                                                           | 构建 spike          |
| 5   | jsquash 适配器 | `src/worker/adapters/jsquash.ts`                 | 各格式 `decode(arrayBuffer) → ImageData → encode(imageData, options)`；wasm 初始化方式核对                                                                                                                                                                                                                                               | 各包 README         |
| 6   | magick 适配器  | `src/worker/adapters/magick.ts`                  | （阶段二）静态 GIF `-layers optimize`/量化、TIFF Deflate 重压缩；动态 `import()` 懒加载                                                                                                                                                                                                                                                  | 构建 spike          |
| 7   | 产物校验       | `src/core/validate.ts`                           | 产物可解析性回读（同格式 decode 一次）、尺寸一致性校验（尺寸必须不变）                                                                                                                                                                                                                                                                   | —                   |
| 8   | 预览对话框     | `src/ui/PreviewDialog.vue` + `src/ui/preview.ts` | 思源 `Dialog` 承载 Vue 组件：前后对比图（blob URL）、大小/节省比例/尺寸/格式/参数/耗时；确认 / 放弃                                                                                                                                                                                                                                      | Dialog 构造细节核对 |
| 9   | 写回           | `src/core/writeback.ts`                          | `putFile` **multipart 表单**（`path`/`isDir=false`/`file` 二进制/`modTime`），路径基准**工作空间根**（`/data/assets/...`、`/data/<boxID>/assets/...`、`/data/emojis/...`），覆盖写；失败自校验（putFile 静默失败，写回后重读比对字节数）；成功后调 `reloadProtyle` 重载受影响编辑器刷新图片显示（已定方案，弃用 img cache-busting 参数） | 源码核对 #D/#H      |
| 10  | 入口注册       | `src/index.ts` 增量                              | `eventBus.on("open-menu-image", ...)`：往 `detail.menu` **追加菜单项**（不自己弹菜单）；`detail.element.querySelector("img")` 取 `data-src`；i18n 文案；加密笔记本 / 跳过格式的提示                                                                                                                                                      | 源码核对 #A         |
| 11  | 构建适配       | `vite.config.ts` / 包内配置                      | Worker 打包（`new Worker(new URL(...), { type: "module" })`）在 lib CJS 产物下的正确性；jsquash wasm 资产 emit 与运行时可达；`optimizeDeps.exclude`                                                                                                                                                                                      | 构建 spike          |

模块间依赖：1 → 2 → (3, 4, 5) → 7 → 8 → 9；10 串起全链路；11 是 4/5/6 的前置构建验证。

## 已确认结论（源码核对，2026-11-28）

- **A 入口**：触发点唯一（`protyle.ts` 图片菜单组装处）；`detail = { protyle, element, menu }`；`element` 是 `.img` 容器，`querySelector("img")` 取 `data-src`；菜单实例即 `detail.menu`（EventBus 注入）；只读右键路径无条件触发、移动端共享同一入口；另有 AV 单元格富文本图片入口（tableCellRichEditor.ts）——本期不接
- **B 路径**：规范存储形式是 `data-src`（相对工作空间 `data/`）；渲染时 src 被锚到内核 origin，`assets/x.png` 与 `/assets/x.png` 等价；路径部分已 URL 编码（`getDecodedPath` 解码）；`?style=thumb` 是内核缩略图参数（写回前剥掉）；`?box=<笔记本ID>` 表示资源在该笔记本本地；`file://`/盘符/`\\` 属内核读不到的本地路径，排除
- **C 格式一致性**：上传只取扩展名原样写盘、无转换；拖拽导入保留原扩展名；**存在扩展名失真路径** → 检测层必须 magic bytes 全量嗅探
- **D 文件 API**：`getFile` 返回原始字节（Content-Type 按扩展名 + mimetype 兜底），失败 HTTP 202 + `{code,msg}`（含 404）；`putFile` 为 **multipart**（`path`/`isDir`/`file` FileHeader/`modTime` 毫秒/`app`），覆盖写，新建文件名须过 `IsValidUploadFileName`，**路径基准是工作空间根而非 data/**（写资源必须 `/data/assets/x.png`），无请求大小硬限制（emoji 专用接口 10MB）
- **E Dialog**：待接入时对照 format-helper 先例核对构造参数（唯一未完成的 API 细节核对）
- **F 构建**：待构建 spike 实测（最阻塞项）
- **G jsquash 契约**：待逐包核对 README（init 方式 / encode options 字段名）
- **H 显示刷新**：内核资源响应带 `Last-Modified`、靠 mtime 重验证（覆盖后 304→200 重取）；但普通资源无 `Cache-Control`，浏览器启发式缓存可能先命中旧图；无现成 `reloadAsset` API。**已定方案**：写回成功后调 `reloadProtyle`（`app/src/protyle/util/reload.ts:18`）重载受影响的编辑器实例——刷新彻底，代价是编辑器重渲染（`detail.protyle` 已在入口事件中拿到，直接传给写回模块）

### 补充结论（全局/笔记本级 assets、加密笔记本、emojis）

- **assets 落盘三级规则**（`getAssetsDir`）：文档级 → 笔记本级 → 全局 `data/assets`；加密 box 强制笔记本级、禁用全局回退。**不能假设 `assets/x.png` 在全局**：带 `?box=` 的引用解析 box 后写 `/data/<boxID>/assets/...`；不带 `?box=` 的按 `GetAssetAbsPath` 语义（data 下搜索命中）确认落点
- **加密笔记本**：资源是 AES-256-GCM 单文件加密容器，文件名脱敏 `uuid-blockID.ext`、原名在元数据；渲染 src 带 `?box=`；锁定时伺服 403 fail-closed。`getFile`/`putFile` 读写全拒绝（code -3）→ **插件侧检测后跳过并提示**，除非内核未来提供加密感知 API
- **emojis**：用户自定义图标在 `<workspace>/data/emojis/`（`appearance/emojis/` 是内置表情勿动）；引用 src 为 `/emojis/<文件名>`；可直接 `getFile`/`putFile`（`/data/emojis/x.png`）；SVG 跳过

## 剩余待办（动工时核对）

1. **构建 spike**（F，最阻塞）：vite 里打包 Worker + 一个 jsquash 格式，验证产物路径与 wasm 可达，再全面动工
2. **Dialog 构造参数**（E）：对照 format-helper 先例
3. **jsquash 各包 README**（G）：固化 init 方式与 §4 参数表
4. 加密笔记本检测的落地方式：`?box=` 解析 box 加密状态，或首次 `getFile` 收到 202 后降级为跳过（后者更简单，MVP 采此）
