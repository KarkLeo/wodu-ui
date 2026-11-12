<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 14,
  strokeWidth: 1.5,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    fill="currentColor"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4.5 3 L11 7 L4.5 11 Z"/>
  </svg>
</template>
