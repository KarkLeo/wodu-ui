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
    <path d="M3 6 C3 4 4.5 3 6 3 M9 6 C9 8 7.5 9 6 9 M9 6 L10.5 4.5 M9 6 L7.5 4.5"/>
  </svg>
</template>
