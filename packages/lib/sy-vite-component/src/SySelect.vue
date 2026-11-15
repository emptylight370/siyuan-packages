<template>
  <select class="b3-select fn__flex-center fn__size200" v-model="model">
    <option v-for="item of options" :key="item.value" :value="item.value">
      {{ item.text }}
    </option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  options: Array<{
    value: string;
    text: string;
  }>;
}>();
const model = defineModel<string>({ default: '' });
</script>
