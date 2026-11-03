<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 14,
  strokeWidth: 1.6,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M7 2 L9 6 L13 6.5 L10 9.5 L11 13 L7 11 L3 13 L4 9.5 L1 6.5 L5 6 Z"/>
  </svg>
</template>
