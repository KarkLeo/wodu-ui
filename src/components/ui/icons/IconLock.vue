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
    <rect x="3" y="5" width="6" height="5" rx="0.5"/>
    <path d="M4 5 L4 3.5 C4 2.5 4.9 2 6 2 C7.1 2 8 2.5 8 3.5 L8 5"/>
  </svg>
</template>
