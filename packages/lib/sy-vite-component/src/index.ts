// 思源风格基础控件：b3-* 样式类由思源宿主提供，组件本身零依赖。
// .vue 文件由消费方的 @vitejs/plugin-vue 编译；vue devDependencies 仅为让
// pnpm 在本包 node_modules 链接 vue，供编译产物 import 'vue' 的解析。
// 新增控件：src/ 下新建 SyXxx.vue（见根 AGENTS.md「内部共享 lib」），在下方追加导出。
export { default as SyButton } from './SyButton.vue';
export { default as SyCheckbox } from './SyCheckbox.vue';
export { default as SyIcon } from './SyIcon.vue';
export { default as SyInput } from './SyInput.vue';
export { default as SySelect } from './SySelect.vue';
export { default as SySettingPanel } from './SySettingPanel.vue';
export { default as SySpace } from './SySpace.vue';
export { default as SyTextarea } from './SyTextarea.vue';
