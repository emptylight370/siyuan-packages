# 图片压缩设计文档（siyuan-image-manager）

> 状态：**草案**。技术选型已定；支持的图片类型清单已依据思源内核代码（`build` 分支 @ `9b052a8`）确认，见 §3.1，遗留问题见文末「待确认事项」。

## 1. 目标

对思源工作空间中的图片文件做体积优化，**保持文件名与路径不变**（块引用与 emoji 引用无需改动）。用户可对每种格式单独决定压缩参数。支持**批量处理**与**单张处理**两种入口；写回前可预览压缩结果与相关信息（见 §5）。

两条硬性约束（来自需求确认）：

1. **不转码格式**：TIFF 用户不接受转码，GIF/TIFF 保留原格式做优化；JPEG/PNG/WebP 重编码时保持原格式
2. **实况照片跳过**：HEIC / HEIF / MOV（含 Live Photo 的成对文件）不做处理，仅标记跳过
3. **加密笔记本跳过**：内核对加密 box 资源一律拒绝 `getFile`/`putFile`（防密文泄漏/明文污染，code -3），现有插件 API 无法覆盖——检测到即跳过并提示（源码核对结论，见 [impl-single-image.md](./impl-single-image.md)）

范围约束：处理对象为**内部 `assets/` 与工作空间 `emojis/` 目录下的本地文件**（emojis 为用户自定义表情图标，在文档中经 `:name:` 引用渲染为图片，处理规则与 assets 完全一致——同一 §3.2 矩阵）。外链图片（`https://…`）无法写回、不在插件管辖内；内核侧 TIFF/HEIC 预览也只对内部 assets 链接生效（外部链接退化为下载），二者一致。

## 2. 技术选型

| 层            | 选型                                                                                     | 说明                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主力编码/解码 | `@jsquash/jpeg` / `@jsquash/png` / `@jsquash/webp` / `@jsquash/oxipng` / `@jsquash/avif` | Squoosh codec wasm，npm 开箱即用；统一 `decode(arrayBuffer) → ImageData`、`encode(ImageData, options) → ArrayBuffer` 契约                                      |
| GIF/TIFF 处理 | `@imagemagick/magick-wasm`                                                               | ImageMagick 官方 wasm（Apache-2.0）。GIF：`-layers optimize` 无损帧优化 + 量化有损重编码；TIFF：LZW/Deflate/ZIP 无损重压缩，有损档可选但默认关闭               |
| 实况照片检测  | 自实现 magic bytes 读取                                                                  | `ftyp` box brand ∈ {`heic`, `heix`, `msf1`, `mif1`} → HEIC；`ftyp qt` → MOV。扩展名（`.heic`/`.heif`/`.mov`）为快速路径，magic bytes 兜底                      |
| 多帧检测      | 自实现格式嗅探                                                                           | jsquash 编解码管线是单帧 `ImageData`，会丢失多帧动画：APNG 按 `acTL` chunk、WebP 按 `ANIM` chunk、GIF 按图像描述符帧数（>1 为动画）检测，命中即跳过（见 §3.2） |

备选方案对比（libcaesium-wasm、pica、browser-image-compression、UTIF.js）见仓库会话结论，不在此展开；关键结论：JPEG/PNG/WebP 上双方编码器同源（mozjpeg / oxipng(zopfli) / libwebp），选 jsquash 是因为 npm 可直接接入、按格式分包按需引入。

## 3. 格式处理矩阵

### 3.1 思源侧格式事实（来源：内核 `build` 分支 @ `9b052a8`，只读代码确认）

- 内核与前端共同的「图片资源」扩展名共 19 项（`SiYuanAssetsImage`）：`.apng` `.ico` `.cur` `.jpg` `.jpe` `.jpeg` `.jfif` `.pjp` `.pjpeg` `.png` `.gif` `.webp` `.bmp` `.svg` `.avif` `.tiff` `.tif` `.heic` `.heif`
- 内核 `assetInlineMediaType` 白名单决定内联显示：JPEG 六变体（`.jpg/.jpe/.jpeg/.jfif/.pjp/.pjpeg` → `image/jpeg`）、png/apng、gif、webp、bmp、ico/cur、avif、heic/heif、tif/tiff；SVG 走独立分支（`serveSVG` sanitize，失败返回 422 不显示）
- **TIFF / HEIC 由内核转码后显示**：`tiffpreview` 与 `kernel/heif` 输出 JPEG 预览，且仅对内部 `assets/` 链接生效（前端 `isBrowserRenderableImagePath` 限制；外部链接退化为下载）。对插件含义：思源里 TIFF/HEIC 的显示不依赖原文件格式，但**写回时必须保持原格式**（约束 #1），否则用户对「文件」的预期被破坏
- `.ico/.cur/.avif` 的渲染依赖 Chromium 解码能力，内核无转码兜底——压缩产物若损坏会直接无法显示，写回前的产物校验（§5）必须覆盖

### 3.2 处理矩阵（按扩展名归一到格式）

扩展名 → 格式归一：六个 JPEG 变体（`.jpg/.jpe/.jpeg/.jfif/.pjp/.pjpeg`）是同一格式（各变体只是元数据/头部差异），统一按 JPEG 处理；`.tif/.tiff` 同理。

| 格式（扩展名）                               | 解码             | 编码/优化                         | 有损                              | 无损                              | 实现层         | 备注                                               |
| -------------------------------------------- | ---------------- | --------------------------------- | --------------------------------- | --------------------------------- | -------------- | -------------------------------------------------- |
| JPEG（.jpg/.jpe/.jpeg/.jfif/.pjp/.pjpeg）    | `@jsquash/jpeg`  | `@jsquash/jpeg` encode（mozjpeg） | ✅ quality / 渐进式 / 色度抽样    | —                                 | jsquash        | 主力路径                                           |
| PNG（.png）                                  | `@jsquash/png`   | `@jsquash/oxipng` optimise        | ❌（jsquash 无 imagequant）       | ✅ 优化级别                       | jsquash        | 主力路径                                           |
| WebP（.webp，静态）                          | `@jsquash/webp`  | `@jsquash/webp` encode（libwebp） | ✅ quality / method               | ✅ lossless / near-lossless       | jsquash        | 动画 WebP（`ANIM` chunk）跳过                      |
| AVIF（.avif，静态）                          | `@jsquash/avif`  | `@jsquash/avif` encode            | ✅ quality                        | ✅ lossless                       | jsquash        | 动画 AVIF 跳过（检测方式待确认 #4）                |
| GIF（.gif，静态）                            | magick-wasm 直读 | magick-wasm                       | ✅ 调色板量化（颜色数可调）       | ✅ `-layers optimize`             | magick-wasm    | 动画 GIF 跳过（帧数 > 1 检测，见 §5）              |
| TIFF（.tif/.tiff）                           | magick-wasm 直读 | magick-wasm                       | 可选，默认关闭（UI 提示画质损失） | ✅ LZW→Deflate/ZIP 重压缩（默认） | magick-wasm    | 内核靠转码预览显示，写回保持原格式                 |
| BMP（.bmp）                                  | —                | —                                 | —                                 | —                                 | 跳过           | 收益有限，不做处理                                 |
| APNG（.apng）                                | —                | —                                 | —                                 | —                                 | 跳过           | `acTL` chunk 检测；多帧，单帧管线会丢帧            |
| ICO / CUR（.ico/.cur）                       | —                | —                                 | —                                 | —                                 | 跳过           | 多帧 icon + 文件本身极小，无压缩价值               |
| SVG（.svg）                                  | —                | —                                 | —                                 | —                                 | 跳过           | 文本格式，不走像素管线                             |
| 加密笔记本资源（src 带 `?box=`、文件名脱敏） | —                | —                                 | —                                 | —                                 | 检测命中即跳过 | 内核拒绝文件 API（code -3），需加密感知 API 才可行 |
| HEIC / HEIF / MOV                            | —                | —                                 | —                                 | —                                 | 检测命中即跳过 | 含 Live Photo 成对文件                             |

> TODO：jsquash 各包 encode 的 options 字段名以对应包 README 为准（如 `@jsquash/jpeg` 的 `quality`/`progressive`、`@jsquash/oxipng` 的 `level`/`interlace`），接入时逐个核对后固化到 §4 参数表。

## 4. 用户参数模型

- 每种格式一个独立参数组，用户在设置界面（思源 `Setting`）中按格式调整；所有参数项带默认值，用户不改则用默认
- 参数持久化走插件 `saveData`/`loadData`，结构带 `schemaVersion` 字段，升级时做兼容迁移
- 参数按「有损 / 无损」分组展示；TIFF 有损档默认关闭，开启时界面提示「有损压缩会永久降低画质，存档类图片建议保持无损」，需用户显式确认

默认值草案（TODO：以 §3 核对结果定稿）：

| 格式 | 参数                   | 默认值                          |
| ---- | ---------------------- | ------------------------------- |
| JPEG | quality                | 0.80                            |
| JPEG | progressive            | true                            |
| JPEG | chroma subsampling     | 420                             |
| PNG  | oxipng level           | 中（具体档位待核对）            |
| WebP | quality                | 0.80                            |
| WebP | method                 | 4                               |
| AVIF | quality                | 0.60（AVIF 常用档位低于 JPEG）  |
| AVIF | lossless               | false                           |
| GIF  | 模式                   | 无损帧优化                      |
| GIF  | 量化颜色数（有损模式） | 128                             |
| TIFF | 压缩算法               | Deflate                         |
| TIFF | deflate level          | 6（Balanced）                   |
| TIFF | 有损模式开关           | false（开启时 UI 提示画质损失） |

> TODO：是否提供「高质量 / 均衡 / 最小体积」全局预设覆盖各格式参数——待确认 #4。

## 5. 架构

```
扫描阶段   收集图片文件（assets 文档引用 + emojis 目录枚举）    ← 方式待确认 #3/#4
   ↓        （emojis 文件不依赖文档引用，直接遍历目录；动画表情同样被多帧检测跳过）
   ↓
检测阶段   扩展名快速路径 + magic bytes 兜底
   ↓        ├─ HEIC/HEIF/MOV → 标记 skipped（实况照片/不支持的宿主格式）
   ↓        ├─ 动画帧：APNG（acTL）/ 动画 WebP（ANIM）/ 动画 GIF（帧数 > 1）→ 标记 skipped（防丢帧）
   ↓        ├─ BMP / SVG / ICO/CUR → 标记 skipped（无处理价值/不走像素管线）
   ↓        └─ 其余 → 进入处理队列
处理阶段   Worker 内按格式分发：
             ├─ jsquash 路径：decode → ImageData → encode(options)
             └─ magick-wasm 路径：直读 → ImageMagick 操作 → 写出
             产物统一暂存（内存 buffer，即「临时文件」，预览与写回共用同一份数据）
   ↓
预览阶段   单张模式：必经，展示处理结果等待确认（见下）
             批量模式：默认直接写回；可配置「逐张确认」开关
   ↓        ├─ 确认 → 写回阶段
             └─ 放弃 → 丢弃暂存 buffer，原文件不动
写回阶段   原子写回：校验产物可解析 → putFile 替换原文件；失败保留原文件并报告
```

处理模式与预览：

1. **单张处理入口**：针对单个图片触发压缩，强制经过预览确认。已确认挂载 `open-menu-image` 事件：往 `detail.menu` 追加菜单项，经 `detail.element.querySelector("img")` 取 `data-src`（详见 [impl-single-image.md](./impl-single-image.md)）
2. **预览面板内容**（数据全部来自压缩产物与原始文件，无额外计算成本）：
   - 前后对比图：原图与压缩图并排/切换展示（产物 buffer 直接 `URL.createObjectURL` 生成 blob URL，同格式可直接 `<img>` 渲染；TIFF 由内核预览通道兜底）
   - 信息：原/新文件大小、节省比例、尺寸（不变，作校验展示）、格式、本次所用参数、处理耗时
   - 不保存任何修改（产物未写回），放弃后内存即释放
3. **临时文件复用**：预览与原子写回共用同一份产物暂存——确认写回时不再重算，直接进入校验 + `putFile`；这也是预览「零额外开销」的来源

工程约定：

1. **Worker 隔离**：压缩全部在 Web Worker 内执行，主线程只做调度与 UI；多图串行处理（复用单实例，避免 worker 池无序膨胀）
2. **懒加载**：`magick-wasm` 体积大（数 MB），必须动态 `import()`——仅当队列中出现 GIF/TIFF 时加载；jsquash 按格式分包，只打包启用的格式
3. **取消与进度**：处理队列支持取消（对应当前任务），按文件粒度上报进度
4. **Vite 适配**：jsquash 已知需 `optimizeDeps.exclude`（官方文档说明）；接入时验证 `pnpm build` 产物中 wasm 资产正确 emit 且运行时路径可达——这是本次选型的主要构建风险点，最早验证
5. **许可**：jsquash 与 magick-wasm 均 Apache-2.0。对象形式分发需满足 Apache-2.0 §4(a)/(d)：`package.zip` 内提供第三方许可文档（如 `dist/THIRD-PARTY-NOTICES`——组件清单 + Apache-2.0 全文一份，所有 Apache-2.0 组件共用 + 各组件 NOTICE 内容，若上游携带则收入）；根工厂注入的 JS banner 只承载本包 MIT 声明与一行指路，**不能替代全文副本**。接入依赖时 TODO：核对各 npm 包是否携带 NOTICE / 额外版权声明文件

## 6. 待确认事项

1. **动画格式检测的实现细节**：GIF 需解析图像描述符统计帧数（>1 为动画）；动画 AVIF 无 PNG/WebP 那样简单的单 chunk 标记——接入时统一在检测层实现并核对 `@jsquash/avif` 解码行为
2. **全局预设**：是否在每格式参数之外提供一键预设
3. **assets 扫描方式**：单张模式入口已确认（`open-menu-image` 事件 + 路径解析与落盘三级规则，见 [impl-single-image.md](./impl-single-image.md)）；批量模式的文档图片枚举方式仍 TODO
4. **emojis 处理细节**：目录已确认（`data/emojis/`，文件 API 可用，SVG 跳过，`appearance/emojis/` 勿动）；剩余——遍历范围、独立开关、最小体积阈值
5. **写回细节**：已确认（`putFile` multipart、路径基准工作空间根、静默失败需写回后自校验、写回成功后调 `reloadProtyle` 重载编辑器刷新显示），细节见 [impl-single-image.md](./impl-single-image.md)
6. **jsquash/magick-wasm 精确版本与参数 schema**：接入时锁定版本并固化 §4 表
7. **批量模式「逐张确认」开关**：是否提供、默认值，接入时结合预览面板交互定稿
