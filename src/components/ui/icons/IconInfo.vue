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
    <path d="M6 1.5 C3 1.5 1 4 1 6 C1 8 3 10.5 6 10.5 C9 10.5 11 8 11 6 C11 4 9 1.5 6 1.5 Z"/>
    <circle cx="6" cy="6" r="1.6" fill="currentColor"/>
  </svg>
</template>
