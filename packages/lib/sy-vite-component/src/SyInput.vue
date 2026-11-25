<!-- 思源输入框：属性面板场景用 label 包裹，无 label 时渲染裸输入框 -->
<template>
  <div class="container fn__block">
    <label v-if="label || $slots.label">
      <slot name="label">
        <div class="config-name">{{ label }}</div>
      </slot>
      <slot v-if="desc || $slots.desc" name="desc">
        <div class="b3-label__text">{{ desc }}</div>
      </slot>
      <div class="fn__hr"></div>
      <input v-bind="inputAttrs()" v-model="model" />
    </label>
    <input v-else v-bind="inputAttrs()" v-model="model" />
  </div>
</template>

<script lang="ts" setup>
const {
  label,
  desc,
  placeholder,
  type = 'text',
  inputName,
} = defineProps<{
  /** 纯文本标题；需要混排富文本（如内嵌链接）时改用 #label 插槽 */
  label?: string;
  /** 纯文本描述；需要混排富文本（如内嵌链接）时改用 #desc 插槽 */
  desc?: string;
  placeholder?: string;
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
.container {
  padding: 8px 16px;
}
</style>
