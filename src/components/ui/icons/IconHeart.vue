<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 14 s-5 -3.5 -5 -8 a3 3 0 0 1 5 -2.2 A3 3 0 0 1 13 6 c0 4.5 -5 8 -5 8 z"/>
  </svg>
</template>
