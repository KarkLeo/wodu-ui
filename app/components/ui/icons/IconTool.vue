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
    <rect x="3" y="6" width="6" height="3" rx="0.5" />
    <path d="M9 7.5 L13 4" />
    <circle cx="13" cy="3.5" r="1.2" />
  </svg>
</template>
