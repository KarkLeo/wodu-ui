<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 22,
  strokeWidth: 1.6,
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 22 22"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="16" height="16" rx="2"/>
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="11" cy="11" r="1" fill="currentColor" stroke="none"/>
    <circle cx="7.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
</template>
