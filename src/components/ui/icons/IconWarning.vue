<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 18,
  strokeWidth: 1.4,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9 2 L16 14 H2 Z" />
    <path d="M9 7 V10" />
    <circle cx="9" cy="12.5" r="0.6" fill="currentColor" />
  </svg>
</template>
