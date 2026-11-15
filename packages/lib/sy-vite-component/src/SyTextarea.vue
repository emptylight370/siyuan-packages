<template>
  <textarea class="b3-text-field fn__block" v-model="model"></textarea>
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' });
</script>
