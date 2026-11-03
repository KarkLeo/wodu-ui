<script setup lang="ts">
withDefaults(defineProps<{
  /** Space between the section's blocks; `lg` for a section of loose fields. */
  gap?: 'md' | 'lg'
}>(), {
  gap: 'md',
})
</script>

<template>
  <section :class="['wz-section', `gap-${gap}`]">
    <slot />
  </section>
</template>

<style scoped>
.wz-section {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.gap-lg { gap: var(--s-4); }
</style>
