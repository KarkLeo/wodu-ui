<script setup lang="ts">
defineProps<{
  variant: 'damage' | 'armor' | 'qty' | 'price' | 'hp'
}>()
</script>

<template>
  <span :class="['item-stat-chip', `is-${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
/* Filled, not outlined, as Pill: an outlined capsule reads as a button. */
.item-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-text-secondary) 12%, transparent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--vtt-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.item-stat-chip.is-damage {
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-accent-deep) 18%, transparent);
  color: var(--vtt-accent-soft);
}
.item-stat-chip.is-price {
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-accent-deep) 18%, transparent);
  color: var(--vtt-accent);
}
/* info and danger-bright fall under AA on any light tint of a card; a fill darker than the card keeps them above it. */
.item-stat-chip.is-armor {
  background: var(--vtt-bg-base);
  background: color-mix(in srgb, var(--vtt-info) 12%, var(--vtt-bg-base));
  color: var(--vtt-info);
}
.item-stat-chip.is-hp {
  background: var(--vtt-bg-base);
  background: color-mix(in srgb, var(--vtt-danger) 15%, var(--vtt-bg-base));
  color: var(--vtt-danger-bright);
}
</style>
