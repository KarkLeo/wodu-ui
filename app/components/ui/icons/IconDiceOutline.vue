<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 16,
  strokeWidth: 1.3,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z"/>
  </svg>
</template>
