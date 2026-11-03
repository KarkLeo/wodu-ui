<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  level?: number | string
  variant?: 'default' | 'reference'
}>(), {
  variant: 'default',
})
</script>

<template>
  <div :class="['ability-card', `variant-${variant}`]">
    <div class="ability-head">
      <div class="ability-head-title">
        <span class="ability-head-title-text">{{ title }}</span>
        <span v-if="level !== undefined" class="ability-level-badge">{{ level }}</span>
      </div>
    </div>
    <div v-if="$slots.default || $slots.actions" class="ability-body">
      <slot />
      <div v-if="$slots.actions" class="ability-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ability-card {
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  overflow: hidden;
  transition: border-color var(--t-fast) var(--ease);
}
.ability-card:hover { border-color: var(--vtt-border-strong); }

.ability-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px 16px 8px;
  user-select: none;
}
.ability-head-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  letter-spacing: 0.01em;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.ability-head-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ability-level-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  padding: 2px 6px;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  flex-shrink: 0;
  line-height: 1.2;
}

.ability-body {
  padding: 0 16px 14px;
  color: var(--vtt-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  display: block;
}

.ability-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--vtt-border-subtle);
  margin-top: 10px;
}

.ability-card.variant-reference {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--vtt-border-subtle);
  border-radius: 0;
}
.ability-card.variant-reference:last-child { border-bottom: none; }
.ability-card.variant-reference .ability-head {
  padding: 10px 0 4px;
  cursor: default;
}
.ability-card.variant-reference .ability-body {
  display: block;
  padding: 0 0 10px;
}
.ability-card.variant-reference .ability-head-title { font-size: 14px; }
</style>
