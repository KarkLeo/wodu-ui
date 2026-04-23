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
    <path d="M6 2 H10 V5 L12 12 C12 13 11 13.5 10 13.5 H6 C5 13.5 4 13 4 12 L6 5 Z"/>
    <path d="M5 10 H11"/>
  </svg>
</template>
