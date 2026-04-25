<script setup lang="ts">
defineProps<{
  variant: 'damage' | 'armor' | 'qty' | 'price'
}>()
</script>

<template>
  <span :class="['item-stat-chip', `is-${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.item-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--vtt-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.item-stat-chip.is-damage {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-accent-deep);
}
.item-stat-chip.is-armor {
  color: var(--vtt-info);
  border-color: rgba(90, 122, 142, 0.45);
}
.item-stat-chip.is-qty {
  color: var(--vtt-text-muted);
  border-color: var(--vtt-border-subtle);
  border-style: dashed;
}
.item-stat-chip.is-price {
  color: var(--vtt-accent);
  border-color: var(--vtt-accent-deep);
  background: rgba(140, 106, 58, 0.08);
}
</style>
