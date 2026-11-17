# plugin-sample-vite-vue 模板拆解

> 对官方 Vue 模板 [siyuan-note/plugin-sample-vite-vue](https://github.com/siyuan-note/plugin-sample-vite-vue)（改编自 frostime 的 sy-plugin-template-vite）的完整拆解，
> 重点讲解 **vite-vue 集成方式**（Vue 应用如何挂进思源插件生命周期）与**产物如何符合插件集市要求**。
> 快照取自 2026-11-17 的 `main` 分支。
> webpack 版模板的拆解见 [plugin-sample.md](./plugin-sample.md)。

## 1. 概述与文件结构

| 文件/目录                              | 说明                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `vite.config.ts`                       | 构建编排（icon/preview 动态 targets、lib CJS、zipPack、livereload）                              |
| `src/index.ts`                         | 插件类（`Plugin` 子类），onload 时调用 `init(this)` 启动 Vue                                     |
| `src/main.ts`                          | **Vue 与插件的桥接层**：`init` / `destroy` / `usePlugin`                                         |
| `src/App.vue`                          | 根组件：思源风格控件演示 + 顶栏按钮 + 状态栏两种挂法                                             |
| `src/components/SiyuanTheme/`          | 6 个思源风格控件（`SyButton` / `SyCheckbox` / `SyIcon` / `SyInput` / `SySelect` / `SyTextarea`） |
| `src/api.ts`                           | 思源内核 API 的完整封装（`fetchSyncPost` 上层）                                                  |
| `src/types/`                           | 全局 ambient 类型（块 ID/类型、`doOperation`、`Window` 扩展、`SyFrontendTypes`）                 |
| `src/utils/index.ts`                   | `getDomByVueComponent(component)`：把 Vue 组件挂成独立 DOM 片段                                  |
| `src/i18n/en_US.json`、`zh_CN.json`    | 语言文件（**下划线**命名；`plugin.json` 里的语言键是横线 `zh-CN`，二者不同）                     |
| `tsconfig.json` + `tsconfig.node.json` | 双 tsconfig（references + composite），`strict: false`                                           |
| `release.js`、`.env.example`、`asset/` | 模板自带的发布脚本 / 工作空间直写配置 / 静态资源目录（monorepo 中均已移除）                      |

## 2. vite-vue 集成：Vue 应用如何挂进插件生命周期

这是模板的核心设计——**插件类保持最小职责，Vue 应用由独立的桥接层管理**。

### 2.1 插件入口（`src/index.ts`）

```ts
import PluginInfoString from '@/../plugin.json'; // 直接 import 清单 JSON（resolveJsonModule）
import { destroy, init } from '@/main';

export default class PluginSample extends Plugin {
  public isMobile: boolean;
  public isBrowser: boolean;
  public isLocal: boolean;
  public isElectron: boolean;
  public isInWindow: boolean;
  public platform: SyFrontendTypes;
  public readonly version = version; // 来自 plugin.json 的 version

  async onload() {
    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes;
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile';
    this.isBrowser = frontEnd.includes('browser');
    this.isLocal = location.href.includes('127.0.0.1') || location.href.includes('localhost');
    this.isInWindow = location.href.includes('window.html');
    // Electron 探测：尝试 require @electron/remote，抛错即为非 Electron 环境
    try {
      require('@electron/remote').require('@electron/remote/main');
      this.isElectron = true;
    } catch (err) {
      this.isElectron = false;
    }

    init(this); // ← 启动 Vue 应用，并绑定插件实例
  }

  onunload() {
    destroy(); // ← 卸载 Vue 应用
  }

  openSetting() {
    window._sy_plugin_sample.openSetting(); // 设置入口委托给 Vue 层（见 §3）
  }
}
```

要点：

1. **`import PluginInfoString from '@/../plugin.json'`**：借助 `resolveJsonModule: true` 把清单 JSON 编译期打进 bundle——`version` 等元信息运行时直接可用，无需发请求（monorepo 中改为读 `meta.json`，且 `plugin.json` 已是构建产物，见 §7）；
2. **平台五态探测**（`isMobile`/`isBrowser`/`isLocal`/`isElectron`/`isInWindow`）全部在 `onload` 完成并挂到实例上，供 Vue 组件经 `usePlugin()` 消费；
3. 插件类只做生命周期转发：`onload → init(this)`、`onunload → destroy()`，**不持有任何 Vue 细节**；
4. `openSetting` 通过 `window._sy_plugin_sample` 命名空间反查 Vue 层——思源调用插件设置入口时，实际执行的是 Vue 组件里注册的函数。

### 2.2 桥接层（`src/main.ts`）

```ts
let plugin = null;
export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps) {
    plugin = pluginProps;
  } // init 时绑定实例
  if (!plugin && !pluginProps) {
    console.error('need bind plugin');
  }
  return plugin; // 组件里 usePlugin() 无参取回实例
}

let app = null;
export function init(plugin: Plugin) {
  usePlugin(plugin); // 先绑定插件实例（组件挂载前就可用）

  const div = document.createElement('div');
  div.classList.toggle('plugin-sample-vite-vue-app');
  div.id = this.name; // ⚠️ 普通函数的 this 是 undefined——实际依赖
  app = createApp(App); //   模块级闭包，元素 id 并非插件名（模板缺陷）
  app.mount(div);
  document.body.appendChild(div); // 挂到 body（非 protyle 内）
}

export function destroy() {
  app.unmount(); // 卸载 Vue 应用（触发组件级清理）
  const div = document.getElementById(this.name);
  document.body.removeChild(div);
}
```

三个 API 的职责：

| API                  | 调用时机                      | 职责                                                               |
| -------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `init(plugin)`       | 插件 `onload`                 | 绑定插件实例 → 创建挂载容器 → `createApp(App).mount`               |
| `destroy()`          | 插件 `onunload`               | `app.unmount()` + 移除容器                                         |
| `usePlugin(plugin?)` | `init` 内绑定；组件内无参调用 | 模块级单例存取插件实例——**组件不需要 props 注入就能拿到 `plugin`** |

**设计解读**：

1. **挂载点是 `document.body`** 而不是某个面板容器——Vue 应用是「常驻悬浮层」（App.vue 根样式 `position: absolute; pointer-events: none`，内容卡片才恢复 `pointer-events: auto`），插件主界面是覆盖在思源之上的独立层，而非嵌入文档流；
2. **`usePlugin` 单例模式**让任意深层组件都能拿到 `plugin` 实例（`this.addTopBar`、`this.addStatusBar`、`this.eventBus` 等），避免 provide/inject 或 props 逐层传递；代价是同页多实例插件会共享闭包（思源每个前端实例独立 bundle，实际无冲突）；
3. `destroy()` 的 `app.unmount()` 会触发组件卸载生命周期，但**不清理** `window._sy_plugin_sample` 与 `addTopBar` 注册的按钮（宿主在插件禁用时统一移除）。

### 2.3 对比：思源插件的两种 UI 形态

| 形态     | plugin-sample（webpack 版）          | 本模板（vite-vue）                          |
| -------- | ------------------------------------ | ------------------------------------------- |
| 主界面   | 无常驻 UI，全部通过菜单/命令按需触发 | `createApp` 挂到 body 的**常驻 Vue 悬浮层** |
| Vue 使用 | 不使用                               | 全量使用（含 `<script setup>`）             |
| 设置入口 | `Setting` 类 / `Dialog`              | `window._sy_plugin_sample` 反查 Vue 层      |
| 状态栏   | `addStatusBar({element})`            | 同款 + **Vue `<Teleport>` 双实现演示**      |

## 3. `App.vue` 示例：Vue 组件里调用思源插件 API

```vue
<script setup lang="ts">
import { usePlugin } from '@/main';
const plugin = usePlugin(); // 取回 onload 时绑定的插件实例

// 在组件 setup 里直接注册顶栏按钮——思源 API 与 Vue 生命周期共存
plugin.addTopBar({
  icon: 'iconHeart',
  title: 'Plugin Sample',
  callback: () => {
    alert('Hello Siyuan.');
  },
});

// 状态栏的两种挂法
onMounted(() => {
  // 方式一：Vue Teleport 把图标"传送"进宿主的状态栏 DOM（statusRef 延迟绑定）
  const status = document.getElementById('status');
  if (status) {
    setTimeout(() => {
      statusRef.value = status;
    }, 5000); // 等宿主状态栏就绪
  }
  // 方式二：思源 addStatusBar（传统方式）
  const tempStatus = document.createElement('div');
  tempStatus.innerHTML = `<svg><use xlink:href="#iconHeart"></use></svg>`;
  plugin.addStatusBar({ element: tempStatus, position: 'right' });
});

// 设置入口注册到全局命名空间，供插件类的 openSetting() 反查
onMounted(() => {
  window._sy_plugin_sample = {};
  window._sy_plugin_sample.openSetting = openSetting;
});
</script>
```

要点：

1. **`onMounted` + `setTimeout` 5 秒**绑定 `#status`（思源底部状态栏的 id）：官方演示了「宿主 DOM 未就绪」的兜底手法——Teleport 目标先以 `ref` 占位，模板里 `v-if="statusRef"` 控制渲染时机；
2. `position: 'right'`：`addStatusBar` 支持位置参数；
3. 根组件样式演示了**穿透悬浮层交互**的技巧：容器层 `pointer-events: none`（放行思源自身的点击），内容卡片 `pointer-events: auto`；
4. `<Teleport :to="statusRef">`：目标可以是动态 ref 指向的真实 DOM。

## 4. SiyuanTheme 控件库

6 个控件全部是**零逻辑的思源样式壳**——直接复用思源内置的 `b3-*` / `fn__*` 类，不引入任何组件库：

```vue
<!-- SyButton.vue 完整源码 -->
<template>
  <button class="b3-button b3-button--outline fn__flex-center fn__size200">
    <slot>Button</slot>
  </button>
</template>

<script setup lang="ts"></script>
```

设计意义：控件外观随思源主题自动变化（用的就是思源自己的 CSS 变量与类），插件无需维护样式。本仓库的 `sy-vite-component` lib 即由此提取（`SyButton` ~ `SyTextarea` 六件套），消费方式一致。

## 5. `src/api.ts`：内核 API 封装

统一封装在 `fetchSyncPost` 之上（`code === 0` 时返回 `data`，否则 `null`），按思源 API 分组导出约 40 个函数：

| 分组         | 函数                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notebook     | `lsNotebooks` / `openNotebook` / `closeNotebook` / `renameNotebook` / `createNotebook` / `removeNotebook` / `getNotebookConf` / `setNotebookConf`         |
| File Tree    | `createDocWithMd` / `renameDoc` / `removeDoc` / `moveDocs` / `getHPathByPath` / `getHPathByID` / `getIDsByHPath`                                          |
| Assets       | `upload`（FormData 多文件）                                                                                                                               |
| Block        | `insertBlock` / `prependBlock` / `appendBlock` / `updateBlock` / `deleteBlock` / `moveBlock` / `getBlockKramdown` / `getChildBlocks` / `transferBlockRef` |
| Attributes   | `setBlockAttrs` / `getBlockAttrs`                                                                                                                         |
| SQL          | `sql(stmt)` / `getBlockByID`                                                                                                                              |
| Template     | `render` / `renderSprig`                                                                                                                                  |
| File         | `getFile` / `putFile`（附 `modTime`，注释标明借自 terwer 的 importer）/ `removeFile` / `readDir`                                                          |
| Export       | `exportMdContent` / `exportResources`                                                                                                                     |
| Convert      | `pandoc(args[])`                                                                                                                                          |
| Notification | `pushMsg` / `pushErrMsg`                                                                                                                                  |
| Network      | `forwardProxy`                                                                                                                                            |
| System       | `bootProgress` / `version` / `currentTime`                                                                                                                |

`types/api.d.ts` 提供对应响应类型（`IReslsNotebooks` 等），`types/index.d.ts` 提供 `BlockId` / `Block` / `doOperation` 等基础类型——全部是 **ambient 全局声明**（无 `export`），源码直接使用无需 import。

> monorepo 中的取舍：这套封装已提取为 `packages/lib/sy-api`（补充了 `getDom`、`updateBlockTransactions` 等）；`plugin-vscodelite-edit` 迁移时删除了模板 api.ts（死代码），统一消费 lib。

## 6. `tsconfig` 双配置

```jsonc
// tsconfig.json（主）
{
  "compilerOptions": {
    "target": "ESNext",
    "moduleResolution": "Node",        // ⚠️ 模板仍是旧值（bundler 才是 vite 惯例）
    "paths": { "@/*": ["./src/*"], "@/libs/*": ["./src/libs/*"] },
    "resolveJsonModule": true,          // 支撑 §2.1 的 import plugin.json
    "types": ["node", "vite/client"],
    "allowImportingTsExtensions": true,
    "strict": false,                    // ⚠️ 模板关闭严格模式
    "noEmit": true,
  },
  "references": [{ "path": "./tsconfig.node.json" }],
  "include": ["tools/**/*.ts", "src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
}

// tsconfig.node.json（vite.config.ts 专用，composite）
{ "compilerOptions": { "composite": true, "module": "ESNext" },
  "include": ["vite.config.ts"] }
```

- `strict: false`：模板刻意放宽，便于新手起步（monorepo 迁移时收紧为 base 的严格模式）；
- `composite` 工程要求显式列出全部导入文件——接入 monorepo 根工厂后 `vite.config.ts` 会因导入 `scripts/vite-plugin-config.ts` 触发 TS6307，因此迁移时**删除 `tsconfig.node.json` 与 references**（`allowImportingTsExtensions` / `noEmit` 已由 `tsconfig.base.json` 提供）。

## 7. 产物如何符合插件集市要求

`vite.config.ts` 是产物合规的核心。逐段拆解（含 monorepo 中的对应改造）：

### 7.1 入口与产物格式

```ts
build: {
  outDir: distDir,                    // 模板：watch 直写工作空间 / prod 写 dist（monorepo 已统一为 dist）
  emptyOutDir: !isWatch,              // ⚠️ watch 不清空——直写的是工作空间；monorepo 改为 true
  lib: {
    entry: resolve(__dirname, "src/index.ts"),
    fileName: "index",
    formats: ["cjs"],                 // 集市期望的产物格式：index.js（CJS）
  },
  rollupOptions: {
    external: ["siyuan", "process"],  // 思源 SDK 是运行时宿主依赖，不参与打包
    output: {
      entryFileNames: "[name].js",
      assetFileNames: (assetInfo) => {
        if (assetInfo.name === "style.css") { return "index.css" }   // ← CSS 产物改名
        return assetInfo.name
      },
    },
  },
},
```

三个合规点：

1. **CJS + `module.exports.default`**：思源加载器对插件包的期望格式（`formats: ["cjs"]`）；
2. **`external: ["siyuan", "process"]`**：产物里 `require("siyuan")` 由宿主提供；
3. **`assetFileNames` 改名**：vite 的 CSS 产物默认叫 `style.css`，思源只自动加载插件目录下的 `index.css`——这行改名是**产物合规的关键一行**。

### 7.2 静态资源复制（`viteStaticCopy` targets）

```ts
const pluginInfo = require('./plugin.json'); // CommonJS require 读清单
const packageImageTargets = [
  ['icon', 'icon.png'],
  ['preview', 'preview.png'],
].flatMap(([field, legacyName]) => {
  const fileName = pluginInfo[field] || (existsSync(legacyName) ? legacyName : '');
  return fileName ? [{ src: `./${fileName}`, dest: './' }] : []; // 清单字段优先，文件存在性兜底
});

viteStaticCopy({
  targets: [
    ...packageImageTargets, // icon.png / preview.png（按清单/存在性过滤）
    { src: './README*.md', dest: './' }, // 双语 README 都进包
    { src: './asset/*', dest: './asset' }, // 插件自带静态资源（可选）
    { src: './plugin.json', dest: './' }, // 清单复制（monorepo 改为 emitPluginJson 合成）
    { src: './src/i18n/**', dest: './i18n/' }, // ⚠️ 无 stripBase：产物是 dist/i18n/src/i18n/*.json（嵌套错误）
  ],
});
```

| 资源                     | 模板行为                  | 集市要求                                      | monorepo 工厂改造                                                               |
| ------------------------ | ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| `index.js` / `index.css` | lib 产物 + 改名           | 必需                                          | 同款；额外注入 `/*! LICENSE */` banner                                          |
| `plugin.json`            | **直接复制源文件**        | 必需（name/url/version 为集市身份）           | `emitPluginJson` 从 bazaar.json + meta.json **合成**（name/url 派生，防伪）     |
| icon / preview           | 清单字段优先 + 存在性兜底 | 必需                                          | 同款逻辑，改从 `resolvePluginMeta` 的 `meta.icon` / `meta.preview` 派生         |
| README                   | `README*.md` 全量         | 必需（`readme` 字段指向）                     | 改从 `meta.readme` 声明生成（防止改文件名漏复制）                               |
| i18n                     | 复制但**无 stripBase**    | `plugin.json` 的 i18n 路径应为 `i18n/xx.json` | 补 `rename: {stripBase: 2}`，产出 `dist/i18n/xx.json`（两个迁移包都踩过嵌套坑） |
| `asset/`                 | 复制                      | 可选                                          | 保留，按需                                                                      |
| `publish.resources`      | **不支持**                | 可选                                          | 工厂 targets 支持目录整树复制（字体包 `fonts/`）                                |

### 7.3 dev 与 prod 的差异

```ts
const isWatch = args.watch || args.w || false
const distDir = isWatch ? devDistDir : "./dist"       // 模板：watch 直写 VITE_SIYUAN_WORKSPACE_PATH

rollupOptions.plugins: isWatch
  ? [livereload(devDistDir),                          // 直写工作空间时的页面热刷新
     { name: "watch-external",                        // 监听模块图之外的文件
       async buildStart() {
         const files = await fg(["src/i18n/*.json", "./README*.md", "./plugin.json"])
         for (const file of files) { this.addWatchFile(file) }
       } }]
  : [zipPack({inDir: "./dist", outDir: "./", outFileName: "package.zip"})]
```

|            | 模板                                                       | monorepo 工厂                                               |
| ---------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| watch 输出 | `VITE_SIYUAN_WORKSPACE_PATH` 指向的工作空间（`.env` 配置） | 包内 `dist/`（`emptyOutDir: true`），调试走根 `deploy` 任务 |
| livereload | 有（直写工作空间才有意义）                                 | 移除                                                        |
| zip        | `zipPack`                                                  | 同款保留                                                    |
| define     | `process.env.DEV_MODE` / `NODE_ENV`                        | 同款保留                                                    |

### 7.4 其他产物相关配置

```ts
resolve: { alias: { "@": resolve(__dirname, "src") } }   // 模板手写 alias → monorepo 改 resolve.tsconfigPaths: true
define: { "process.env.DEV_MODE": ..., "NODE_ENV": ... } // 源码用 DEV_MODE 切换调试行为
```

`package.json` 的 `"type": "module"`（monorepo 全部包已声明）——vite lib CJS 产物不受影响，但它是 `configLoader: 'native'` 正常加载 vite.config.ts 的前提。

## 8. 与 plugin-sample（webpack 版）的对照

|              | plugin-sample（webpack）              | plugin-sample-vite-vue                           |
| ------------ | ------------------------------------- | ------------------------------------------------ |
| UI 形态      | 菜单/命令按需触发，无常驻 UI          | body 常驻 Vue 悬浮层                             |
| Vue          | 不使用                                | 全量（`<script setup>` + Teleport）              |
| 插件实例获取 | `this`（类内）                        | `usePlugin()` 模块级单例                         |
| 清单读取     | 运行时 `require("./plugin.json")`     | 编译期 `import plugin.json`（resolveJsonModule） |
| 构建         | webpack 5 双配置（可含 kernel.js）    | vite 单配置                                      |
| CSS 产物     | MiniCssExtractPlugin 输出 `index.css` | `assetFileNames` 改名 `style.css` → `index.css`  |
| 事件演示     | Event Bus 子菜单（全量事件 On/Off）   | 无（专注 UI 集成）                               |
| 设置界面     | `Setting` 类完整演示                  | 仅命名空间反查占位                               |

## 9. 模板的已知缺陷（monorepo 迁移时已修正）

1. `main.ts` 的 `init` / `destroy` 里 `this.name`：普通函数内 `this` 是 `undefined`，容器 id 实际为 `undefined`（重复 `getElementById(undefined)` 依赖隐式行为）——本仓库 `plugin-vscodelite-edit` 改用模块级常量容器 id；
2. i18n 复制无 `stripBase`，产物嵌套 `dist/i18n/src/i18n/`；
3. `plugin.json` 作为**源文件直接复制**——集市 `name`/`url` 可被篡改；monorepo 改为 `emitPluginJson` 从 bazaar.json + `meta.json` 合成；
4. watch 直写工作空间 + livereload——monorepo 统一收敛到包内 `dist/` + `deploy` 任务；
5. `tsconfig.node.json` 的 composite 工程（见 §6）与手写 `@` alias（改 `resolve.tsconfigPaths`）。
