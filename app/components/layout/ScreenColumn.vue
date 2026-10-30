<template>
  <div class="screen-column">
    <slot />
  </div>
</template>

<style scoped>
.screen-column {
  /* Centred, and never under GameLayout's side panels. */
  --sc-w: min(640px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--sc-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--sc-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--sc-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
