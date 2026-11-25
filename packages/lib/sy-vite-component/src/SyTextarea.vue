<!-- 思源属性面板textarea输入框：属性面板场景用 label 包裹，无 label 时渲染裸 textarea -->
<template>
  <label v-if="label || $slots.label" class="b3-label b3-label--noborder">
    <slot name="label">{{ label }}</slot>
    <div class="fn__hr"></div>
    <textarea v-bind="textareaAttrs()" v-model="model"></textarea>
  </label>
  <textarea v-else v-bind="textareaAttrs()" v-model="model"></textarea>
</template>

<script lang="ts" setup>
const {
  label,
  placeholder,
  rows = 2,
  textareaName,
} = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  placeholder?: string;
  rows?: number;
  textareaName?: string;
}>();
const model = defineModel<string>({ default: '' });

function textareaAttrs() {
  return {
    style: 'resize: vertical',
    spellcheck: false,
    class: 'b3-text-field fn__block',
    placeholder,
    rows,
    'data-name': textareaName,
  };
}
</script>

<style lang="scss" scoped>
label {
  padding: 8px 16px;
}
</style>
