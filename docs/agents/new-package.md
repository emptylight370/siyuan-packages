# 新增一个包

新增包有两种来源：迁移既有仓库，或从官方模板新建。两者的改造终点相同，起点差异如下：

|                       | 迁移既有仓库（git subtree）                 | 官方模板新建（`siyuan-note/plugin-sample-vite-vue`）                                            |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 历史 tag 与已发布记录 | 有，需 `whatschange.old.md` 存档            | 无，首个版本从 `0.0.1` 直接开始                                                                 |
| 中文 README           | 旧仓库可能是 `README_zh_CN.md`，需重命名    | 官方已是 `README.zh-CN.md`                                                                      |
| 自带 AI 指引          | 可能有 `CODEBUDDY.md` / `AGENTS.md`         | 无                                                                                              |
| 包名                  | 与目录一致，无需改                          | 需把模板名 `plugin-sample-vite-vue` 改为新包名                                                  |
| `mise.toml`           | 可能有 `[env]`，只删 `[tools]` / `[deps.*]` | 模板无 mise 配置，无需处理                                                                      |
| 演示代码              | 无                                          | `src/` 含模板示例（`App.vue` 菜单示例、`components/SiyuanTheme`、`types/`、`utils/`），按需保留 |

## 共通改造

1. 把源 `plugin.json` 拆成 `meta.json`（独有字段 + `version`），不要提交 `plugin.json`（构建产物）；`author`、`backends`、`disabledInPublish`、`icon`、`preview`、`readme`、`funding` 由 `bazaar.json` 提供，不要写进 meta；多语言键用横线 `zh-CN`（与 `i18n/zh_CN.json` 的下划线不同）
2. 构建接入（全部包统一 vite）：
   - 新建包内 `vite.config.ts` 转发根工厂 `createPluginViteConfig({ pkgDir: import.meta.dirname, deps: { defineConfig, fg, minimist, viteStaticCopy, zipPack } })`；有 `.vue` 源码的包额外传 `vue`（`deps.vue` 可选）；对工厂的 import **必须带 `.ts` 扩展名**（`configLoader: 'native'` 下由 Node 原生运行时直接执行配置文件，不做扩展名推断）
   - 工厂已内置：`emitPluginJson` 输出产物 `plugin.json`、i18n `stripBase`、LICENSE banner（生产构建注入 JS chunk）、`publish.resources` 复制（如字体包的 `fonts/`）、`build.target` 由 tsconfck 从 tsconfig 解析；watch 监听 `./meta.json` 与根 `../../../bazaar.json`
   - 包内 `tsconfig.json` 必须声明源码用到的路径别名（如 `"@/*": ["./src/*"]`）——别名由 vite 原生 `resolve.tsconfigPaths` 从 tsconfig `paths` 读取（工厂已开启，无需插件）；同时把 `"vite.config.ts"` 加入 `include`，使配置文件纳入工程检查；`tsconfig.json` 继承 `../../../tsconfig.base.json`
   - watch 与 production 一律构建到包内 `dist/`（调试走根 `deploy` 任务）；`tsconfig.json` 继承 `../../../tsconfig.base.json`
   - CSS/SCSS 引用**包外运行时路径**（思源挂载路径，如 `../plugins/<pkg>/fonts/*.woff`）会被 vite 报「didn't resolve at build time」警告并原样保留——预期行为，不要改成包内相对路径
3. `package.json` 精简：scripts 为 `lint`（oxlint）/ `dev` / `build` / `clean`，删除 `release*`；devDeps 只留构建所需并升级到 monorepo 现行版本（模板自带 vite 6、eslint 9、@antfu/eslint-config 4、ts-node、glob、@vue/tsconfig 一律不要），`vue` 移到 devDeps，`siyuan` 统一 `1.3.0`；`rimraf`、`@types/*` 由根提供不再声明；不写 `author`、`description`、`devEngines`、`homepage`、`repository` 等发布用字段，`version` 由 pre-commit 的 `syncversion.ps1` 自动对齐
4. 新建包内 `cliff.toml`：改 `tag_pattern`、`include_paths`、`output`（`whatschange.md`）、`<REPO>`，标题用 `split(pat="@") | last`（详见 [release.md](./release.md#changelog-配置)）

5. 包内 `mise.toml` 声明 `[tasks.changelog] run = "mise run //:changelog"`（输出/旧日志文件名非缺省时加 `env = { CHANGELOG_OUTPUT = "...", CHANGELOG_LEGACY = "..." }`；内部 lib / 不需生成的包写 `[tasks.changelog] run = ""` 占位，否则 pre-commit 会失败）
6. 补包内 `AGENTS.md`：构建栈、模块职责、i18n 命名、隐性约定
7. 验证：根 `pnpm install` → `pnpm -r build` → `pnpm lint` → `pnpm exec tsc --noEmit -p packages/plugin/<pkg>/tsconfig.json` → `mise run //packages/plugin/<pkg>:changelog`（包目录内亦可 `mise run changelog`）；确认 `dist/plugin.json` 的 `name` / `url` / `version` 为派生值。新包落在 `config_roots` glob 内，其 scripts 与任务会自动出现在根目录 `mise tasks --all`
8. 发布：初始化目标仓库 stub（README 重定向 + `.github/ISSUE_TEMPLATE/config.yml`）并提供 `main` 分支，`mise run tag` 后推送 tag

## 迁移来源的差异步骤

1. `git subtree add --prefix=packages/<type>/<pkg> <repo> main`
2. 删除 `mise.lock`、`lefthook.yml`、`.prettierrc`、`.gitignore`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.mise/locks/`、`.vscode/`、`.github/`、`build.mjs`、`release.js`、`.oxlintrc.json`、`CHANGELOG.md`、原仓库 AI 指引；`mise.toml` 只删 `[tools]` / `[deps.*]`
3. 把旧仓库的 `whatschange.md` 存为 `whatschange.old.md` 并迁移其中链接；历史 tag 在 cliff 中全部失效（subtree 保留的提交路径不匹配 `packages/**`，实测命中 0），**不要在已发布版本上运行 `changelog`**
4. `README_zh_CN.md` 等旧命名重命名为 `README.zh-CN.md`

## 官方模板新建的差异步骤

1. `git clone --depth=1 https://github.com/siyuan-note/plugin-sample-vite-vue packages/plugin/<newpkg>` 并删除其中的 `.git` 与 `.github/`
2. 删除 `release.js`、`eslint.config.mjs`、`CHANGELOG.md`、`.editorconfig`、`.env.example`（`VITE_SIYUAN_WORKSPACE_PATH` 直写工作空间的逻辑已移除）（monorepo 未使用）；保留 `asset/`
3. 模板 `viteStaticCopy` 按 `plugin.json` 的 `icon` / `preview` 字段动态生成图片 targets——改造后改为从 `resolvePluginMeta` 返回的 `meta.icon` / `meta.preview` 派生
4. 官方模板的 i18n 复制无 `stripBase`，必须补 `rename: { stripBase: 2 }`，否则产物出现 `dist/i18n/src/i18n/*.json` 嵌套（`siyuan-ignoreeditor` 与 `plugin-vscodelite-edit` 都踩过）
5. 演示代码取舍：`src/components/SiyuanTheme/`（主题控件）、`src/types/`（思源类型）、`src/utils/`（挂载工具）通常保留；`App.vue` 的示例逻辑按新包功能重写
6. 模板 `package.json` 无 `clean` / `lint` script，需补上；devDeps 需整体升级（模板 vite 6、@vitejs/plugin-vue 5、siyuan 1.1.0 均落后于 monorepo 现行版本）
7. 首次发布：`mise run tag` 生成 `<pkg>@0.0.1`，推送后触发 CI

## 官方最简示例的两条特殊路线

### theme-sample（主题包，零构建）

官方主题示例只有 9 个文件：`theme.json`、`theme.css`、`icon.png`、`preview.png`、README×2、`CHANGELOG.md`、`LICENSE`——**没有 `src/`、没有构建器、没有任何 npm 依赖**，源码即产物。`theme.json` 字段与 `plugin.json` 几乎同构（`name`/`author`/`url`/`version`/`minAppVersion`/`displayName`/`description`/`readme`/`icon`/`preview`/`funding`/`keywords`），差异是没有 `backends`、多了 `modes`（`["light"]` / `["dark"]` / `["light","dark"]`）。

接入前需要先扩展基础设施（当前全部面向插件）：

1. `bazaar.json` 增加 `types.theme` 模板：`author`、`icon`、`preview`、`readme`、`funding`；`modes` 是包特有字段，写进包内 `meta.json`
2. `scripts/plugin-meta.ts` 的 `REQUIRED_FIELDS` 需按 `pkgType` 区分：主题不含 `backends`（也不含 `frontends`，主题清单无此字段）；`metaFile = \`${pkgType}.json\``会自动输出`theme.json`，现有代码无需改动
3. `deploy.ps1` 的映射已有 `theme = 'themes'`，但脚本会先执行 `pnpm --filter <pkg> build`——主题无构建脚本，需改为跳过构建、把包根（`theme.json`、`theme.css`、图标）直接镜像到 `data/themes/<pkg>`
4. `release.yml` 的 `pnpm --filter <pkg> build` 对无 build script 的包会报错，`package.zip` 也需另行生成（PowerShell `Compress-Archive` 或独立 zip 步骤）——接入第一个主题包时一并处理
5. `tsconfig.base.json` 对主题无意义（没有 TS 源码），`tsconfig.json` 可省略

### plugin-sample（webpack 双入口）

官方最简插件用 **webpack 5 双配置**（`webpack.config.js` 前端 + `webpack.kernel.config.js` 内核）：dev 时 `run-p` 并行监听两个配置，build 时 `run-s` 先 kernel 后 app 串行；转译用 `esbuild-loader`，格式化用 `dprint`（非 prettier），另有 `patches/`（pnpm patch）与 `tests/`（node --test）。

迁移路线按需选择：

| 路线         | 做法                                                                                                                 | 适用                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 迁 vite      | 与现有包同构转发根工厂；kernel 产物用 `build.rollupOptions.input` 第二入口或 `--config` 第二个配置文件输出到不同目录 | kernel 产物只是静态资源      |
| 保留 webpack | 包内自洽（webpack、esbuild-loader、zip-webpack-plugin 留在包内），根只管聚合；`tsconfig` 仍继承 base                 | 内核构建逻辑复杂、不值得重写 |

无论哪条路线：`dprint` 换成 prettier（根已配置），`patches/` 的依赖补丁逐个确认是否仍必要；双入口的 `build` 编排（`run-p` / `run-s`）可用 `npm-run-all` 保留或改用 pnpm 的并行 script（`pnpm run --filter` / `&`）
