<template>
  <input class="b3-switch fn__flex-center" type="checkbox" v-model="model" />
</template>

<script setup lang="ts">
const model = defineModel<boolean>({ default: false });
</script>
