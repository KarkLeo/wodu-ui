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
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9 3 L5 7 L9 11"/>
  </svg>
</template>
