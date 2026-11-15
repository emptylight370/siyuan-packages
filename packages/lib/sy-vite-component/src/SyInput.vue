<template>
  <input class="b3-text-field fn__flex-center fn__size200" v-model="model" v-bind="$attrs" />
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' });
</script>
