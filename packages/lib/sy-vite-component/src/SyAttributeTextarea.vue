<!-- 思源属性面板textarea输入框 -->
<template>
  <label class="b3-label b3-label--noborder">
    <slot name="label">{{ label }}</slot>
    <div class="fn__hr"></div>
    <textarea
      style="resize: vertical"
      spellcheck="false"
      class="b3-text-field fn__block"
      v-model="model"
      :placeholder="placeholder"
      :rows="rows"
      :data-name="textareaName"></textarea>
  </label>
</template>

<script lang="ts" setup>
const { rows = 2 } = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  placeholder?: string;
  rows?: number;
  textareaName?: string;
}>();
const model = defineModel<string>({ default: '' });
</script>
