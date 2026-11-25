<template>
  <div v-if="show" class="b3-dialog--open">
    <div class="b3-dialog" :style="{ zIndex: zIndex }">
      <div class="b3-dialog__scrim" @click="close"></div>
      <div class="b3-dialog__container">
        <div v-if="$slots.header" class="b3-dialog__header" @selectstart.prevent>
          <slot name="header"></slot>
        </div>
        <div class="b3-dialog__body">
          <div class="fn__flex fn__flex-1 config__panel" style="overflow: hidden; position: relative">
            <slot>Setting Panel</slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const show = defineModel<boolean>('show', { default: false });

const emit = defineEmits<{ close: [] }>();
const { zIndex = 16 } = defineProps<{ zIndex?: number }>();

/**
 * 父组件需监听close事件，并关闭弹窗
 */
function close() {
  emit('close');
}
</script>
