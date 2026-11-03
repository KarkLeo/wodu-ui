<script setup lang="ts">
import SectionLabel from './SectionLabel.vue'

withDefaults(defineProps<{
  label: string
  /** `inline`: the label beside the value (a settings card); `stacked`: the label over the value (a summary list). */
  layout?: 'inline' | 'stacked'
  tone?: 'neutral' | 'accent'
  /** An id for the label, so a control in the `#action` slot can be named by it (`aria-labelledby`). */
  labelId?: string
}>(), {
  layout: 'inline',
  tone: 'neutral',
  labelId: undefined,
})
</script>

<template>
  <div :class="['kv-row', `is-${layout}`]">
    <span v-if="$slots.icon" class="kv-row-icon" aria-hidden="true"><slot name="icon" /></span>
    <div class="kv-row-body">
      <SectionLabel :id="labelId" :tone="tone" class="kv-row-label">{{ label }}</SectionLabel>
      <span v-if="$slots.default" class="kv-row-value"><slot /></span>
    </div>
    <span v-if="$slots.action" class="kv-row-action"><slot name="action" /></span>
  </div>
</template>

<style scoped>
.kv-row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: 52px;
  padding: var(--s-2) 0;
}
.kv-row + .kv-row { border-top: 1px solid var(--vtt-border-subtle); }

.kv-row-icon {
  flex: 0 0 22px;
  display: inline-flex;
  justify-content: center;
  color: var(--vtt-accent-deep);
}
.kv-row-icon :slotted(svg) { width: 18px; height: 18px; display: block; }

.kv-row-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.is-stacked .kv-row-body { flex-direction: column; align-items: flex-start; gap: 2px; }

.kv-row-label { flex: 0 0 auto; }
.is-inline .kv-row-label { min-width: 96px; }

.kv-row-value {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-secondary);
}
.is-inline .kv-row-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.is-stacked .kv-row-value {
  font-size: 16px;
  line-height: 1.2;
  color: var(--vtt-text-primary);
}

.kv-row-action { flex: 0 0 auto; display: inline-flex; align-items: center; margin-left: auto; }
</style>
