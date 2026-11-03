<script setup lang="ts">
withDefaults(defineProps<{
  /** The element to render, e.g. `main` when the column is the page's main landmark. */
  as?: 'div' | 'main' | 'section'
  /** `narrow`: a single card set lower on the screen (the invite link). */
  size?: 'default' | 'narrow'
}>(), {
  as: 'div',
  size: 'default',
})
</script>

<template>
  <component :is="as" :class="['screen-column', `screen-column--${size}`]">
    <slot />
  </component>
</template>

<style scoped>
.screen-column {
  /* Centred, and never under GameLayout's side panels. */
  --sc-max: 640px;
  --sc-w: min(var(--sc-max), 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--sc-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--sc-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--sc-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.screen-column--narrow { --sc-max: 420px; padding: 48px 16px; }
</style>
