<!-- 思源属性面板input输入框 -->
<template>
  <label class="b3-label b3-label--noborder">
    <slot name="label">{{ label }}</slot>
    <div class="fn__hr"></div>
    <input
      class="b3-text-field fn__block"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      spellcheck="false"
      :data-name="inputName" />
  </label>
</template>

<script lang="ts" setup>
const { type = 'text' } = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  placeholder?: string;
  /** 原生 input type；走 property 赋值，undefined 会被转成 "undefined"，必须给默认值 */
  type?: string;
  inputName?: string;
}>();
const model = defineModel<string>({ default: '' });
</script>
