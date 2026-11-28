<template>
  <div class="plugin-app-main">
    <div class="demo">
      <div>Hello Siyuan. {{ plugin.name }}@{{ version }}</div>
      <SyButton @click="onClick">Say Hello</SyButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SyButton } from 'sy-vite-component';
import { usePlugin } from '@/main';

const plugin = usePlugin();
const version = plugin.version;

const onClick = () => {
  alert('Hello Siyuan.');
};

// 示例：添加顶栏按钮（按需保留/重写）
plugin.addTopBar({
  icon: 'iconHeart',
  title: plugin.name,
  callback: () => {
    alert('Hello Siyuan.');
  },
});
</script>

<!-- 局部样式 -->
<style lang="scss" scoped>
.plugin-app-main {
  width: 100%;
  height: 100%;
  max-height: 100vh;
  box-sizing: border-box;
  pointer-events: none;

  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;

  .demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    pointer-events: auto;

    z-index: 10;

    background-color: var(--b3-theme-surface);
    border-radius: var(--b3-border-radius);
    border: 1px solid var(--b3-border-color);
    padding: 16px;
  }
}
</style>

<!-- 全局样式：挂载容器铺满视口但穿透点击（覆盖 .plugin-template-app，与 main.ts 对应） -->
<style lang="scss">
.plugin-template-app {
  width: 100vw;
  height: 100dvh;
  max-height: 100vh;
  position: absolute;
  top: 0px;
  left: 0px;
  pointer-events: none;
  box-sizing: border-box;
}
</style>
