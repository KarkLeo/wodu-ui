<script setup lang="ts">
import SectionLabel from './SectionLabel.vue'

withDefaults(defineProps<{
  title: string
  /** A short italic note next to the title. */
  hint?: string
  /** Shown after the title as `· N`. */
  count?: number | string
  /** A mono note at the right end: a total, a summary. */
  meta?: string
  /** `label`: the small mono caption of a block; `heading`: the larger serif title of a panel. */
  variant?: 'label' | 'heading'
  /** The title's element; a heading (`h2`, `h3`) only where the section is one for assistive tech. */
  as?: string
}>(), {
  hint: undefined,
  count: undefined,
  meta: undefined,
  variant: 'label',
  as: 'span',
})
</script>

<template>
  <div :class="['section-header', `is-${variant}`]">
    <SectionLabel v-if="variant === 'label'" :as="as" class="section-header-title">{{ title }}<span v-if="count !== undefined" class="section-header-count"> · {{ count }}</span></SectionLabel>
    <component :is="as" v-else class="section-header-title section-header-heading">{{ title }}<span v-if="count !== undefined" class="section-header-count"> · {{ count }}</span></component>
    <span v-if="hint" class="section-header-hint">{{ hint }}</span>
    <span v-if="meta" class="section-header-meta">{{ meta }}</span>
    <span v-if="$slots.action" class="section-header-action"><slot name="action" /></span>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}
.section-header-count { color: var(--vtt-text-muted); }
.section-header-heading {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--vtt-text-primary);
}
.section-header-hint {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.section-header-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--vtt-text-muted);
}
.section-header-action { display: inline-flex; align-items: baseline; }
.section-header-meta,
.section-header-action { margin-left: auto; }
.section-header-meta + .section-header-action { margin-left: 0; }
</style>
