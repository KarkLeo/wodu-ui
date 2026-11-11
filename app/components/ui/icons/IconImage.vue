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
    <rect x="1.5" y="2" width="9" height="8" rx="1.2"/>
    <circle cx="4.2" cy="4.6" r="0.9"/>
    <path d="M1.8 9.2 L4.8 6.6 L7 8.4 L8.4 7.2 L10.2 8.8"/>
  </svg>
</template>
