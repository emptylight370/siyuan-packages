# plugin-sample 插件示例拆解

> 对官方示例仓库 [siyuan-note/plugin-sample](https://github.com/siyuan-note/plugin-sample) 的完整拆解，
> 作为插件 API 的权威参考。快照版本：**v0.5.2**（`minAppVersion: 3.8.5`，快照取自 2026-11-17 的 `main` 分支）。

## 1. 概述与文件结构

| 文件                                            | 说明                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/index.ts`                                  | 插件主入口（约 1430 行），演示全部前端 Plugin API                                   |
| `src/kernel.ts`                                 | **内核插件**参考实现（运行在内核的 goja 引擎中），演示 `globalThis.siyuan` 内核 API |
| `src/declarations.d.ts`                         | `*.scss` 模块声明                                                                   |
| `src/index.scss`                                | 示例样式（`.plugin-sample__custom-tab` 等三个类）                                   |
| `src/i18n/en.json`、`zh-CN.json`                | 语言文件（横线命名 `zh-CN`）                                                        |
| `webpack.config.js`、`webpack.kernel.config.js` | **webpack 双配置**：前端 + 内核两个入口                                             |
| `plugin.json`                                   | 清单（含 `kernels`、`publish.data`、`settingsWindow`）                              |
| `patches/siyuan@1.2.9.patch`                    | pnpm patch：为 `siyuan@1.2.9` 类型补 `openInWindow` 参数与 `IScrollAttr` 导出       |
| `tests/*.test.mjs`                              | `node --test` 测试（publish、settingsWindow 行为）                                  |
| `dprint.json` + `eslint.config.mjs`             | 双格式化工具（模板用 dprint，本仓库用 prettier）                                    |

清单要点（`plugin.json`）：`kernels` 与 `backends` 同形（全平台）——因为有内核产物；`settingsWindow: true`（独立设置窗口，3.8.7+）；`publish: { resources: [], data: ["readonlyText"] }`——声明哪些字段对发布端访客可见；`minAppVersion: 3.8.5`。

## 2. 生命周期

```ts
export default class PluginSample extends Plugin {
    declare i18n: Record<string, string>;
    private blockIconEventBindThis = this.blockIconEvent.bind(this);   // 预 bind：off 必须传同一引用
    private readonly renderCounterCustomBlock = ({element, content, setContent}) => {...};

    onload() {
        // ① 环境探测（每个前端实例独立执行）
        this.isSettingsWindow = document.body.classList.contains("body--settings");
        this.isReadonly = Boolean(window.siyuan.config.readonly || window.siyuan.isPublish);
        this.data[STORAGE_NAME] = {readonlyText: this.i18n.readonlyText};
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // ② 自定义块渲染器注册（发布端也保留）
        this.customBlockRenders[CUSTOM_BLOCK_TYPE] = {render: this.renderCounterCustomBlock};

        // ③ 分支注册：只读端仅保留内容渲染；设置窗口仅初始化设置项；普通前端注册全部示例
        if (this.isReadonly) return;
        if (this.isSettingsWindow) { this.initSetting(); return; }

        // ④ 普通前端：内核事件、工具栏、面包屑、图标、页签、命令、Dock、设置、斜杠命令……
    }

    async onLayoutReady() {
        if (this.isSettingsWindow) { /* body 钩子类名 + onDataChanged */ return; }
        const topBarElement = this.addTopBar({...});   // 顶栏按钮在 layoutReady 注册
        if (this.isReadonly) { await this.loadPublishedSettings(); return; }
        this.addStatusBar({...});                       // 状态栏
        await this.onDataChanged();                     // 读取插件存储
    }

    async onunload() {
        this.endDateSetting();                          // 使挂起的日期写入失效
        if (this.isSettingsWindow) { /* 清理 body 类名 */ return; }
        if (this.isReadonly) return;
        this.eventBus.off("kernel-plugin-state-change", this.onKernelPluginStateChange);
        await Promise.all([this.kernel.rpc.unbind("unload", ...), this.kernel.rpc.unbind("notify", ...)]);
    }

    async uninstall() {
        // 卸载插件时删除插件数据（只读端跳过）
        await Promise.all([STORAGE_NAME, DATE_STORAGE_NAME].map(name => this.removeData(name)));
    }
}
```

要点：

1. **环境分支先行**：`isReadonly`（发布服务访客）、`isSettingsWindow`（独立设置窗口）、`isMobile` 三态决定注册哪些入口，避免只读端/设置窗口出现管理类 UI；
2. **生命周期钩子中的早返回**是官方推荐的多前端适配方式，而不是在各个 API 调用处散落判断；
3. `uninstall` 与 `onunload` 职责分离：前者清理持久数据，后者清理运行时监听；
4. `updateCards(options)` 是可选钩子：翻牌卡加载时对卡片排序（按 `blockID`）。

## 3. 块图标菜单：`click-blockicon` + `transaction`

官方的块菜单示例与本仓库 format-helper 采用同一模式（单次事务批量提交）：

```ts
private blockIconEvent({detail}: any) {
    detail.menu.addItem({
        id: "pluginSample_removeSpace",      // 菜单项 id：用于定位/去重
        iconHTML: "",
        label: this.i18n.removeSpace,
        click: () => {
            const doOperations: IOperation[] = [];
            detail.blockElements.forEach((item: HTMLElement) => {
                const editElement = item.querySelector('[contenteditable="true"]');
                if (editElement) {
                    editElement.textContent = editElement.textContent.replace(/ /g, "");
                    doOperations.push({
                        id: item.dataset.nodeId,        // 直接取 dataset，无需 getAttribute
                        data: item.outerHTML,           // 改写后的编辑器 DOM 即块数据
                        action: "update",
                    });
                }
            });
            detail.protyle.getInstance().transaction(doOperations);   // 单次事务，一次 undo 全部回滚
        },
    });
}
```

## 4. 顶栏按钮：`addTopBar`

```ts
const topBarElement = this.addTopBar({
  icon: this.isReadonly ? 'iconEmoji' : 'iconFace',
  title: this.i18n.addTopBarIcon,
  position: 'right', // 顶栏位置
  contextMenu: (menu) => {
    // 右键（长按）菜单
    if (this.isReadonly || this.isMobile) return;
    menu.addItem({
      id: 'plugin-sample-settings',
      icon: 'iconSettings',
      label: this.i18n.openPluginSettings,
      click: () => this.openSetting(),
    });
  },
  callback: () => {
    // 左键点击 → 弹出面板菜单
    if (this.isMobile) {
      this.addMenu();
    } else {
      let rect = topBarElement.getBoundingClientRect();
      if (rect.width === 0) {
        rect = document.querySelector('#barMore').getBoundingClientRect();
      }
      if (rect.width === 0) {
        rect = document.querySelector('#barPlugins').getBoundingClientRect();
      }
      this.addMenu(rect); // 按钮被顶栏折叠时回退到「更多」/「插件」按钮的坐标
    }
  },
});
```

## 5. 面板菜单：`Menu` / `menu.addItem` 全量用法

```ts
private addMenu(rect?: DOMRect) {
    const menu = new Menu("topBarSample", () => {...});   // 第二参数为菜单关闭回调
    if (this.isReadonly) { /* 只读分支：readonly 项 + 刷新发布快照 */ }

    menu.addItem({icon: "iconSettings", label: "Open Setting", click: () => openSetting(this.app)});
    menu.addItem({icon: "iconInfo", label: "Dialog(open doc first)",
        accelerator: this.commands[0].customHotkey,       // 菜单项可显示命令快捷键
        click: () => this.showDialog()});
    // ...openTab 系列、Event Bus 子菜单、分隔线、readonly 文本
    this.openMenu(menu, rect);
}

private openMenu(menu: Menu, rect?: DOMRect) {
    if (this.isMobile) {
        menu.fullscreen();                                // 移动端全屏面板
    } else {
        menu.open({x: rect.right, y: rect.bottom, isLeft: true});
    }
}
```

`addItem` 支持的字段（示例中出现过的全部变体）：

| 字段                | 用途                                                                                           | 示例                            |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| `id`                | 菜单项定位/去重                                                                                | `id: "plugin-sample-settings"`  |
| `icon` / `iconHTML` | 图标 id / 自定义 HTML                                                                          | `iconHTML: ""` 隐藏图标         |
| `label`             | 文本，**支持 HTML**（不可信内容需先转义，见 `addReadonlyText` 用 `textContent` → `innerHTML`） |                                 |
| `type`              | `"submenu"` / `"readonly"` / `"separator"`                                                     |                                 |
| `click`             | 同步或 async 回调                                                                              |                                 |
| `accelerator`       | 显示命令快捷键                                                                                 | `this.commands[0].customHotkey` |
| `submenu`           | 子菜单数组                                                                                     |                                 |

菜单项引用的宿主 API（都有对应演示）：`openSetting(this.app)`、`openAttributePanel`、`getModelByDockType("file") as Files → selectItem`、`openTab`（`custom`/`asset`/`doc`/`search`/`card` 五种）、`addFloatLayer`、`openWindow`、`openMobileFileById`（移动端）、`lockScreen`、`exitSiYuan`、`saveLayout`。

## 6. 命令系统：`addCommand`

```ts
this.addCommand({
    langKey: "showDialog",                 // i18n 键：命令名可被用户改写
    hotkey: "⇧⌘O",
    execute: (context: ICommandContext) => {...},   // 带上下文（protyle/range/fileTree/dock）
    callback: () => {...},                 // 普通回调
    editorCallback: () => {...},           // 编辑器内触发
});
this.addCommand({langKey: "getTab", hotkey: "⇧⌘M", globalCallback: () => {...}});
```

四种回调层次：`execute`（含 `ICommandContext`）、`editorCallback`（编辑器内）、`callback`（普通）、`globalCallback`（全局）。

## 7. 数据存储与设置界面

### 存储三件套

```ts
await this.saveData(STORAGE_NAME, { ...this.data[STORAGE_NAME], readonlyText: value }); // 写（回调/await）
const data = await this.loadData(STORAGE_NAME); // 读
await Promise.all([STORAGE_NAME, DATE_STORAGE_NAME].map((name) => this.removeData(name))); // 删
```

### `Setting` 构建设置界面（`initSetting`）

```ts
this.setting = new Setting({
    // openInWindow: true,   // 取消注释后桌面端用独立原生窗口打开（3.8.7+），见 patches/siyuan@1.2.9.patch
    confirmCallback: () => { this.saveData(STORAGE_NAME, {...}); },
});
this.setting.addItem({
    title: this.i18n.readonlyText,
    direction: "row",
    description: this.i18n.readonlyTextTip,
    createActionElement: () => textareaElement,     // 每次打开设置时创建控件（可复用元素）
});
this.setting.addItem({title: ..., actionElement: publishButton});   // 静态控件用 actionElement
```

示例还演示了两个**共享选择器 API**（带特性探测）：

```ts
if (!('openColorPicker' in siyuan) || typeof siyuan.openColorPicker !== 'function') {
  showMessage(this.i18n.colorPickerUnavailable); // 低版本思源没有该 API
  return;
}
const picker = siyuan.openColorPicker({ value, ownerPlugin: this, ownerElement, title, onPreview, onPreviewEnd });
const result = await picker.result; // {type: "confirm", value, changed} | {type: "cancel"}
```

`siyuan.openDatePicker` 同构。

### 并发与一致性控制（多窗口场景）

日期设置的读写用 **revision 计数器 + 挂起标志 + 超时竞赛** 保证多窗口/多实例下的一致性：

```ts
private async saveDate(value: string) {
    if (this.dateSavePending) { showMessage(this.i18n.datePickerSaveUncertain); return; }
    const revision = ++this.dateSettingsRevision;
    this.dateSavePending = true;
    const saved = Promise.resolve().then(() => this.saveData(DATE_STORAGE_NAME, data)).then(settle, e => settle(e, true));
    await Promise.race([saved, new Promise(r => { timer = setTimeout(() => {
        showMessage(this.i18n.datePickerSaveUncertain);   // 超时≠失败：允许查看，但未确认前不重试
        resolve();
    }, 10000); })]);
}
```

- 过期的成功响应（`revision` 已推进）不代表当前存储值 → 重新 `loadData`；
- `endDateSetting()` 在 `onunload` 使所有挂起回调失效（`refreshDateSetting` 清空）。

## 8. 发布端只读模式（`publish` / `disabledInPublish`）

发布服务（publish）访客端打开的插件实例 `isReadonly = true`，只保留内容渲染：

```ts
private async loadPublishedSettings() {
    this.data[STORAGE_NAME] = {readonlyText: this.i18n.readonlyText};   // 先清缓存，任何失败都用默认值
    const data = await this.loadPublishData();                          // 读 publish.data 声明的公开快照
    if (typeof data.readonlyText === "string") { this.data[STORAGE_NAME] = {readonlyText: data.readonlyText}; }
}
private async publishSettings(readonlyText: string) {
    await this.savePublishData({readonlyText});   // 仅选择声明过的公开字段，完整替换快照
}
```

错误按 `code` 细分提示：403（未授权/未开启发布）、404（管理员未生成快照）、其他（加载失败）。对应清单字段 `publish: {data: ["readonlyText"]}` 与设置里的「生成发布快照」按钮。

## 9. 事件总线：全量事件演示

「Event Bus」子菜单对每个事件提供 **On/Off 成对项**（事件清单见下表），处理函数统一为预绑定的箭头函数属性（引用稳定）：

| 事件                                                                                                                                                                                                                        | 分类             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `ws-main`                                                                                                                                                                                                                   | WebSocket 主通道 |
| `click-blockicon` / `click-pdf` / `click-editorcontent` / `click-editortitleicon` / `click-flashcard-action` / `open-noneditableblock`                                                                                      | 点击类           |
| `loaded-protyle-static` / `loaded-protyle-dynamic` / `switch-protyle` / `destroy-protyle`                                                                                                                                   | 编辑器生命周期   |
| `open-menu-doctree` / `open-menu-blockref` / `open-menu-fileannotationref` / `open-menu-tag` / `open-menu-link` / `open-menu-image` / `open-menu-av` / `open-menu-content` / `open-menu-breadcrumbmore` / `open-menu-inbox` | 右键菜单类       |
| `input-search` / `paste`                                                                                                                                                                                                    | 输入类           |
| `open-siyuan-url-plugin` / `open-siyuan-url-block`                                                                                                                                                                          | siyuan:// 协议   |
| `opened-notebook` / `closed-notebook` / `kernel-plugin-state-change`                                                                                                                                                        | 状态类           |

**`paste` 事件的特殊契约**（异步接管必须成对调用）：

```ts
private readonly eventBusPaste = (event: any) => {
    event.preventDefault();                            // 接管默认处理
    event.detail.resolve({textPlain: event.detail.textPlain.trim()});   // 必须 resolve，否则卡死
};
```

## 10. 自定义块（`;;;` 语法 + `customBlockRenders`）

```ts
// onload 中注册渲染器（发布端也注册——访客端可见）
this.customBlockRenders[CUSTOM_BLOCK_TYPE] = {render: this.renderCounterCustomBlock};

// 渲染器：element 是块 DOM，content 是块文本，setContent 把新文本写回块（返回 false 表示放弃）
private readonly renderCounterCustomBlock = ({element, content, setContent}) => {
    let count = Number(content) || 0;
    const button = document.createElement("button");
    const increase = () => {
        const nextCount = count + 1;
        if (setContent(nextCount.toString())) { count = nextCount; updateLabel(); }
    };
    element.append(button);
    return () => button.removeEventListener("click", increase);   // 返回清理函数
};

// 插入自定义块：;;;插件名/类型\n内容\n;;; 经 Lute 转成块 DOM
const markdown = `;;;${encodeURIComponent(this.name)}/${encodeURIComponent(CUSTOM_BLOCK_TYPE)}\n0\n;;;`;
protyle.getInstance().insert(protyle.lute.Md2BlockDOM(markdown), true);
```

## 11. UI 注册 API 一览

| API | 说明 | 关键字段 |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| `addToolbarItem` | 编辑器工具栏按钮 | `name`/`icon`/`hotkey`/`tipPosition`/`tip`/`click(protyle)` |
| `addBreadcrumbButton` | 面包屑按钮（每编辑器） | `id`/`icon`/`title`/`callback(event, protyle)` |
| `protyleSlash` | 编辑器 `/` 斜杠命令 | `filter`（匹配词）/`html`（渲染）/`id`/`callback(protyle)` |
| `addStatusBar` | 底部状态栏元素 | `element`（自建 DOM） |
| `addDock` | Dock 面板 | `config{position,size,icon,title,hotkey}`/`data`/`type`/`init`/`resize`/`update`/`destroy` |
| `addTab` | 自定义页签 | `type`/`init`/`beforeDestroy`/`destroy`；`this.data` 为 openTab 传入的 data |
| `addIcons` | 注册自定义 SVG 图标（`<symbol>`），供 `icon: "iconFace"` 引用 | 字符串模板 |
| `protyleOptions` | 定制编辑器工具栏布局 | `toolbar: ["block-ref", "a", "                                                             | ", "text", ...]` |

Dock 的 `init` 区分移动端/桌面端渲染两套 HTML；页签/面板的 `id` 必须带插件名前缀（`this.name + TAB_TYPE`）。

## 12. Dialog 与 Protyle 嵌入

```ts
private showDialog() {
    const dialog = new Dialog({
        title: `SiYuan ${Constants.SIYUAN_VERSION}`,
        content: `...<div id="protyle"></div>`,
        width: this.isMobile ? "92vw" : "560px",
        height: "540px",
    });
    new Protyle(this.app, dialog.element.querySelector("#protyle"), {
        blockId: this.getEditor().protyle.block.rootID,   // 嵌入当前文档的只读预览
    });
    fetchPost("/api/system/currentTime", {}, (response) => {   // API 调用：fetchPost 封装
        dialog.element.querySelector("#time").innerHTML = new Date(response.data).toString();
    });
}
```

自定义设置对话框的旧版写法（注释保留在源码中）演示了 `dialog.bindInput(input, () => btns.click())` 的回车绑定技巧。

## 13. 内核插件（`src/kernel.ts`）

`kernel.ts` 经 `webpack.kernel.config.js` 单独编译为 `kernel.js`，**运行在内核的 goja 引擎**（非浏览器），由内核驱动生命周期：

```
ready → loading → loaded → running → stopping → stopped
        ↓onload   ↓onloaded  ↓onrunning  ↓onunload
```

每个钩子 async-safe：内核 await 返回的 Promise 后才推进状态——慢钩子会拖慢插件自身启动，长任务应 fire-and-forget。

### 前端侧对接（index.ts）

```ts
// onload：绑定内核推送
this.kernel.rpc.bind("unload", this.onKernelPluginUnload);
this.kernel.rpc.bind("notify", this.onKernelPluginNotify);
this.eventBus.on("kernel-plugin-state-change", this.onKernelPluginStateChange);

// kernel-plugin-state-change（code 2 = running）里演示三种调用：
await this.kernel.rpc.notify["echo-notify"](...params);            // 通知（无响应）
const result = await this.kernel.rpc.call.echo(...params);         // 调用
const response = await this.kernel.rpc.batch(                      // 批量（混合 call/notify）
    {id: 0, method: "echo", params: {...}},
    {method: "echo", params: [...]},
    {method: "echo-notify", params: {...}, notification: true},
);
// onunload：对称解绑
await Promise.all([this.kernel.rpc.unbind("unload", ...), this.kernel.rpc.unbind("notify", ...)]);
```

### 内核侧 API 面（`globalThis.siyuan`）

| 域       | API                                                                                                                              | 说明                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 生命周期 | `plugin.lifecycle.onload/onrunning/onunload`                                                                                     | 绑定钩子；`running` 前 RPC 调用以 `-32002` 拒绝                                                                                                  |
| 日志     | `logger.trace/debug/info/warn/error`（Promise）；`console.*`（同步，util.format 路由到内核日志）                                 |                                                                                                                                                  |
| RPC      | `rpc.bind(method, handler, desc)` / `rpc.unbind` / `rpc.broadcast(type, args)`                                                   | broadcast 在非 running 态是空操作（快速关机安全）                                                                                                |
| Agent    | `agent.registerCapability(name, schema, handler)` / `unregisterCapability`                                                       | 注册可被调用的能力（JSON Schema 描述输入输出）                                                                                                   |
| 存储     | `storage.watcher.add/remove`、`storage.put/get/list/remove`                                                                      | 路径相对 `data/storage/petal/<插件>/`，内核阻止路径遍历；`get` 返回单次使用的 `IDataObject`（`text()/json()/arrayBuffer()/buffer()` 只能调一个） |
| 客户端   | `client.fetch`（HTTP JSON-RPC 回环）、`client.socket`（WebSocket，**回调须在 `open()` 前全部分配**）、`client.event`（SSE 订阅） |                                                                                                                                                  |
| 服务器   | `server.private.{http,ws,es}.handler`                                                                                            | 私有路由 `/plugin/private//<path>`，需内核认证与管理员角色；HTTP body 支持 `data/file/string/raw/redirect` 五选一                                |
| 事件     | `event.emit(topic, message)`                                                                                                     | 桥接内核入站事件，形状 `{id, type, detail}`                                                                                                      |

## 14. 构建工程（webpack 双配置）

`webpack.config.js`（前端）与 `webpack.kernel.config.js`（内核）由 `run-p` 并行、`run-s` 串行编排：

```js
entry: {[production ? "dist/index" : "index"]: "./src/index.ts"},
output: {libraryTarget: "commonjs2", library: {type: "commonjs2"}},   // CJS 导出
externals: {siyuan: "siyuan"},                                        // 运行时依赖
```

生产构建的关键插件：

| 插件                                            | 作用                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `esbuild-loader`（target es6）+ `EsbuildPlugin` | TS 转译与压缩                                                                                                                                                      |
| `MiniCssExtractPlugin`                          | SCSS → `index.css`（dev 写包根，prod 写 `dist/`）                                                                                                                  |
| `webpack.BannerPlugin`                          | 生产构建把 `LICENSE` 全文注入产物头部（与我们 postBanner 的做法一致）                                                                                              |
| `CopyPlugin`                                    | icon/preview（**从 plugin.json 字段读取文件名，不存在时回退 legacy 名**）、`README*.md`、`plugin.json`、`boot-appearances/`（可选）、`src/i18n/`、`dist/kernel.js` |
| `ZipPlugin`                                     | 打 `dist/` 为 `package.zip`（gzip，`pathMapper` 去掉 `dist/` 前缀）                                                                                                |

dev 模式：watch + `eval-source-map`，仅复制 `src/i18n/` 到包根。

其它工程件：`patches/siyuan@1.2.9.patch`（pnpm patch：补 `Setting.openInWindow` 类型与 `IScrollAttr` 导出）；`tests/` 用 `node --test` 测试 publish/settingsWindow 行为；`dprint.json` + `eslint.config.mjs` 双格式化（本仓库统一用 prettier）。

## 15. 与 monorepo 现行实践的对照

| plugin-sample                                        | 本仓库（vite 工厂）                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| webpack 双配置（前端 + 内核）                        | 单 vite 工厂（无内核产物包；接入内核包时参考其双入口思路）             |
| `BannerPlugin` 注入 LICENSE                          | rolldown `postBanner`（vite 8 不透传传统 `output.banner`）             |
| `CopyPlugin` 复制 icon/preview/i18n/boot-appearances | `viteStaticCopy`（readme 从 `meta.readme` 生成 + `publish.resources`） |
| `ZipPlugin`                                          | `vite-plugin-zip-pack`                                                 |
| `resolve.extensions` 支持无后缀                      | `configLoader: 'native'` 要求配置导入显式 `.ts` 扩展名                 |
| `transaction` 批量提交                               | format-helper 已采用同款模式                                           |
| `openInWindow`（3.8.7+）需 patch 类型                | `settingsWindow` 走 `check-packages` 版本门槛校验                      |
| 模板版权行                                           | 集市要求改为作者本人（各包 LICENSE 已按此处理）                        |
