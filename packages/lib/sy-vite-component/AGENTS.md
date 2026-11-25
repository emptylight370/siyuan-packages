# sy-vite-component

思源风格基础控件库（源自 vite-vue 模板的 SiyuanTheme）的内部共享 lib。跨包规则以仓库根 `AGENTS.md` 为准。

## 定位与边界

- 不发布集市，无 `meta.json` / `cliff.toml`；以 `workspace:*` 源码级打进插件产物
- 许可证 **MIT**（`LICENSE`，© 2026 EmptyLight）；`package.json` 为 `private: true`，不发布 npm
- 控件依赖思源宿主的 `b3-*` / `fn__*` 样式类，本身零运行时依赖；**只在思源插件 UI 环境内可用**
- SFC 由消费方的 `@vitejs/plugin-vue` 编译；本包不做独立 tsc（消费方经 `declare module '*.vue'` 将组件视为 any）
- `devDependencies.vue` 的用途：让 pnpm 在本包 node_modules 链接 vue，供 SFC 编译产物 `import 'vue'` 的解析（组件源码只用编译宏，不 import vue）

## 结构

| 路径                                                                                                     | 职责                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/SyButton.vue` / `SyCheckbox.vue` / `SyIcon.vue` / `SyInput.vue` / `SySelect.vue` / `SyTextarea.vue` | 基础控件，平铺在 `src/`                                      |
| `src/index.ts`                                                                                           | 全部控件具名导出 + 新增控件指引                              |
| `mise.toml`                                                                                              | `[tasks.changelog] run = ""` 占位任务（lefthook 要求），勿删 |

## 关键约定

1. **控件命名**：PascalCase、`Sy` 前缀（思源 SiYuan 缩写）
2. **样式**：只用思源宿主的 `b3-*` / `fn__*` 类；组件私有的结构性布局才用 scoped style（参照 `SyIcon` 的 `.enIconContainer`），不引入主题
3. **v-model**：模型参数名视具体需求决定，不强制默认名——基础输入类控件（`SyInput` / `SyTextarea` 等）语义单一，用默认 `modelValue` / `update:modelValue`（用法 `v-model`）；容器/面板类控件（如 `SySettingPanel`）绑定的是显隐等非值语义，用具名模型（如 `defineModel<boolean>('show')`，用法 `v-model:show`）。事件类型断言沿用 `($event.target as HTMLInputElement)` 写法
4. **props 类型仍建议写 `defineProps<{...}>` 泛型**：当前消费方不受检查（`*.vue` 声明为 any），引入 vue-tsc 后即自动生效

## 新增控件的步骤

1. `src/` 下新建 `SyXxx.vue`（约定见上与根 `AGENTS.md`「内部共享 lib」段）
2. `src/index.ts` 追加 `export { default as SyXxx } from './SyXxx.vue';`
3. 不引入新 npm 依赖就不改 `package.json`；需要思源 API/类型时归 `sy-api`，不进组件库
4. 验证：`pnpm -r build`（SFC 由消费方 vite 编译，构建即验证）+ `pnpm lint`；消费方 `import { SyXxx } from 'sy-vite-component'`
