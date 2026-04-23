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
    <path d="M5 6 L11 6 L12 13 L4 13 Z"/>
    <path d="M6 6 C6 4 6.5 3 8 3 C9.5 3 10 4 10 6"/>
    <path d="M6 8.5 L10 8.5"/>
  </svg>
</template>
