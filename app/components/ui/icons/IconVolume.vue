<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 12,
  strokeWidth: 1.3,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M1.5 4.5 H3.5 L6 2.4 V9.6 L3.5 7.5 H1.5 Z"/>
    <path d="M8 4.2 C8.8 5.1 8.8 6.9 8 7.8"/>
    <path d="M9.6 2.8 C11 4.3 11 7.7 9.6 9.2"/>
  </svg>
</template>
