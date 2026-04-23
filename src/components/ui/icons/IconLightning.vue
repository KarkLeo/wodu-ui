<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 10 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 10 10"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5 1 L5 4 L7 4 L5 9 L5 6 L3 6 Z"/>
  </svg>
</template>
