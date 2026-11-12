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
    <path d="M4.5 8.6 V2.6 L9.5 1.6 V7.6"/>
    <circle cx="3.2" cy="8.8" r="1.3"/>
    <circle cx="8.2" cy="7.8" r="1.3"/>
  </svg>
</template>
