<script setup lang="ts">
import { useId } from 'vue'
import IconChevronRight from './icons/IconChevronRight.vue'

defineProps<{
  /** Term/text pairs shown at the top of the open body. */
  details?: Array<{ label: string; text: string }>
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const titleId = useId()
const bodyId = `${titleId}-body`
</script>

<template>
  <li :class="['accordion-row', { 'is-open': expanded }]" :aria-labelledby="titleId">
    <button
      type="button"
      class="accordion-head"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      <span :id="titleId" class="accordion-title"><slot name="title" /></span>
      <span v-if="$slots.meta" class="accordion-meta"><slot name="meta" /></span>
      <IconChevronRight class="accordion-chevron" aria-hidden="true" />
    </button>

    <div v-if="expanded" :id="bodyId" class="accordion-body">
      <dl v-if="details?.length" class="accordion-details">
        <template v-for="d in details" :key="d.label">
          <dt>{{ d.label }}</dt>
          <dd>{{ d.text }}</dd>
        </template>
      </dl>
      <slot />
      <div v-if="$slots.actions" class="accordion-actions"><slot name="actions" /></div>
    </div>
  </li>
</template>

<style scoped>
.accordion-row {
  list-style: none;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  transition: border-color var(--t-fast) var(--ease);
}
.accordion-row:hover,
.accordion-row.is-open { border-color: var(--vtt-border-strong); }

.accordion-head {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.accordion-head:focus-visible {
  outline: 2px solid var(--vtt-accent);
  outline-offset: -2px;
  border-radius: var(--r-sm);
}
.accordion-title {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.25;
  color: var(--vtt-accent-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.accordion-meta { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
/* A meta wrapper that renders nothing (chips with nothing to show) takes no room. */
.accordion-meta:empty,
.accordion-meta:has(> :only-child:empty) { display: none; }
/* Without meta the chevron would slide next to the title. */
.accordion-chevron {
  grid-column: 3;
  width: 12px;
  height: 12px;
  color: var(--vtt-text-muted);
  transition: transform var(--t-fast) var(--ease);
}
.accordion-row.is-open .accordion-chevron { transform: rotate(90deg); color: var(--vtt-accent); }

.accordion-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 14px 12px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.accordion-details { margin: 10px 0 0; display: flex; flex-direction: column; gap: 4px; }
.accordion-details dt {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.accordion-details dd {
  margin: 0 0 6px;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.45;
  color: var(--vtt-text-primary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.accordion-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; }

@media (max-width: 419px) {
  .accordion-head { grid-template-columns: minmax(0, 1fr) auto; }
  .accordion-chevron { grid-column: 2; }
  .accordion-meta { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; }
}
</style>
