<template>
  <div v-if="show" class="b3-dialog--open">
    <div class="b3-dialog" :style="{ zIndex: zIndex }">
      <div class="b3-dialog__scrim" @click="close"></div>
      <div class="b3-dialog__container b3-dialog__container--theme" :style="{ width: width, height: height }">
        <div v-if="$slots.header" class="b3-dialog__header resize__move" @selectstart.prevent @pointerdown="startDrag">
          <slot name="header"></slot>
        </div>
        <div class="b3-dialog__body">
          <div class="fn__flex fn__flex-1 config__panel">
            <slot>Setting Panel</slot>
          </div>
        </div>
        <div class="resize__rd" @pointerdown="startResize($event, 'rd')"></div>
        <div class="resize__ld" @pointerdown="startResize($event, 'ld')"></div>
        <div class="resize__lt" @pointerdown="startResize($event, 'lt')"></div>
        <div class="resize__rt" @pointerdown="startResize($event, 'rt')"></div>
        <div class="resize__r" @pointerdown="startResize($event, 'r')"></div>
        <div class="resize__d" @pointerdown="startResize($event, 'd')"></div>
        <div class="resize__t" @pointerdown="startResize($event, 't')"></div>
        <div class="resize__l" @pointerdown="startResize($event, 'l')"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const show = defineModel<boolean>('show', { default: false });

const emit = defineEmits<{ close: [] }>();
const {
  zIndex = 16,
  width = '60vw',
  height = '80vh',
} = defineProps<{ zIndex?: number; width?: string; height?: string }>();

/**
 * 父组件需监听close事件，并关闭弹窗
 */
function close() {
  emit('close');
}

/** 缩放方向：单边 r/d/l/t 与四角 rd/ld/lt/rt */
type ResizeDir = 'r' | 'd' | 'l' | 't' | 'rd' | 'ld' | 'lt' | 'rt';

const MIN_W = 320;
const MIN_H = 200;

/**
 * 捕获指针后把 move/up 重定向到触发元素，交互结束自动清理。
 * 用 setPointerCapture 而非 window 监听：无需手动管理挂载期清理。
 */
function beginPointerFlow(e: PointerEvent, onMove: (ev: PointerEvent) => void) {
  e.preventDefault(); // 阻止拖动/缩放过程中的文本选择
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);

  const move = (ev: PointerEvent) => onMove(ev);
  const stop = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', stop);
    el.removeEventListener('pointercancel', stop);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}

/**
 * 首次交互时把宿主的居中定位显式化为 left/top，
 * 此后移动/左侧缩放才能通过改写 left/top 生效。
 */
function normalizePosition(container: HTMLElement) {
  if (container.dataset.normalized) return;
  const rect = container.getBoundingClientRect();
  Object.assign(container.style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    margin: '0',
  });
  container.dataset.normalized = '1';
}

/** 拖动窗口：热区仅 header（resize__move 提供手型光标） */
function startDrag(e: PointerEvent) {
  if (e.button !== 0) return;
  const container = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
  normalizePosition(container);
  const rect = container.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  beginPointerFlow(e, (ev) => {
    const x = Math.min(Math.max(ev.clientX - offsetX, 0), window.innerWidth - rect.width);
    const y = Math.min(Math.max(ev.clientY - offsetY, 0), window.innerHeight - rect.height);
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
  });
}

/** 按方向调整尺寸：右/下改 width/height，左/上同步改 left/top 并保持对侧边缘不动 */
function startResize(e: PointerEvent, dir: ResizeDir) {
  if (e.button !== 0) return;
  const container = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
  normalizePosition(container);
  const rect = container.getBoundingClientRect();

  beginPointerFlow(e, (ev) => {
    if (dir.includes('r')) {
      const w = Math.min(Math.max(ev.clientX - rect.left, MIN_W), window.innerWidth - rect.left);
      container.style.width = `${w}px`;
    }
    if (dir.includes('d')) {
      const h = Math.min(Math.max(ev.clientY - rect.top, MIN_H), window.innerHeight - rect.top);
      container.style.height = `${h}px`;
    }
    if (dir.includes('l')) {
      const x = Math.min(Math.max(ev.clientX, 0), rect.right - MIN_W);
      container.style.left = `${x}px`;
      container.style.width = `${rect.right - x}px`;
    }
    if (dir.includes('t')) {
      const y = Math.min(Math.max(ev.clientY, 0), rect.bottom - MIN_H);
      container.style.top = `${y}px`;
      container.style.height = `${rect.bottom - y}px`;
    }
  });
}
</script>
