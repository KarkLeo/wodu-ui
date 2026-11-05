<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string; strokeWidth?: number | string }>(), {
  size: 16,
  strokeWidth: 1.4,
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
    <path d="M3 7.5 C3 4.5 5.2 2.5 8 2.5 C10.8 2.5 13 4.5 13 7.5 C13 9 12.3 10 11.5 10.6 V13 H4.5 V10.6 C3.7 10 3 9 3 7.5 Z" />
    <path d="M6.2 7.2 V8.2 M9.8 7.2 V8.2 M7 13 V11.5 M9 13 V11.5" />
  </svg>
</template>
