<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 16,
  strokeWidth: 1.4,
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
    <path d="M3 3 L9 9 M3 3 H5.5 M3 3 V5.5" />
    <path d="M13 3 L7 9 M13 3 H10.5 M13 3 V5.5" />
    <path d="M5.5 8.5 L3.5 10.5 M10.5 8.5 L12.5 10.5 M3 13 L5 11 M13 13 L11 11" />
  </svg>
</template>
