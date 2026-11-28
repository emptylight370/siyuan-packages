<!-- 思源属性面板textarea输入框：属性面板场景用 label 包裹，无 label 时渲染裸 textarea -->
<template>
  <div class="container">
    <label v-if="label || $slots.label">
      <slot name="label">
        <div class="config-name">{{ label }}</div>
      </slot>
      <slot v-if="desc || $slots.desc" name="desc">
        <div class="b3-label__text">{{ desc }}</div>
      </slot>
      <div class="fn__hr"></div>
      <textarea v-bind="textareaAttrs()" v-model="model"></textarea>
    </label>
    <textarea v-else v-bind="textareaAttrs()" v-model="model"></textarea>
  </div>
</template>

<script lang="ts" setup>
const {
  label,
  desc,
  placeholder,
  rows = 2,
  textareaName,
} = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  /** 纯文本描述；需要混排富文本（如内嵌链接）时改用 #desc 插槽 */
  desc?: string;
  placeholder?: string;
  rows?: number;
  textareaName?: string;
}>();
const model = defineModel<string>({ default: '' });

function textareaAttrs() {
  return {
    style: 'resize: vertical; width: calc(100% - 8px)',
    spellcheck: false,
    class: 'b3-text-field',
    placeholder,
    rows,
    'data-name': textareaName,
  };
}
</script>

<style lang="scss" scoped>
.container {
  padding: 8px 16px;
}
</style>
