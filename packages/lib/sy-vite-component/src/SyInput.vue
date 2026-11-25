<!-- 思源输入框：属性面板场景用 label 包裹，无 label 时渲染裸输入框 -->
<template>
  <label v-if="label || $slots.label" class="b3-label b3-label--noborder">
    <slot name="label">{{ label }}</slot>
    <div class="fn__hr"></div>
    <input v-bind="inputAttrs()" v-model="model" />
  </label>
  <input v-else v-bind="inputAttrs()" v-model="model" />
</template>

<script lang="ts" setup>
const {
  label,
  placeholder,
  type = 'text',
  inputName,
} = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  placeholder?: string;
  /** 原生 input type；走 property 赋值，undefined 会被转成 "undefined"，必须给默认值 */
  type?: string;
  inputName?: string;
}>();
const model = defineModel<string>({ default: '' });

function inputAttrs() {
  return {
    class: 'b3-text-field fn__block',
    spellcheck: false,
    type,
    placeholder,
    'data-name': inputName,
  };
}
</script>

<style lang="scss" scoped>
label {
  padding: 8px 16px;
}
</style>
