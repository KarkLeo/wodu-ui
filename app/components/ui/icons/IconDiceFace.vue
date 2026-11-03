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
    aria-hidden="true"
  >
    <rect x="2" y="2" width="8" height="8" rx="1"/>
    <circle cx="4.5" cy="4.5" r="0.6" fill="currentColor"/>
    <circle cx="7.5" cy="4.5" r="0.6" fill="currentColor"/>
    <circle cx="6" cy="6" r="0.6" fill="currentColor"/>
    <circle cx="4.5" cy="7.5" r="0.6" fill="currentColor"/>
    <circle cx="7.5" cy="7.5" r="0.6" fill="currentColor"/>
  </svg>
</template>
