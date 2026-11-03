<script setup lang="ts">
withDefaults(defineProps<{
  /** The element to render; a heading (`h2`) when the label names a section for assistive tech. */
  as?: string
  /** `sm` 10px for a block or a field group, `md` 11px for a caption over a screen or a card. */
  size?: 'md' | 'sm'
  /** `accent` names a section, `neutral` labels a field or a group of rows. */
  tone?: 'accent' | 'neutral'
}>(), {
  as: 'span',
  size: 'sm',
  tone: 'accent',
})
</script>

<template>
  <component :is="as" :class="['section-label', `is-${size}`, `is-${tone}`]"><slot /></component>
</template>

<style scoped>
.section-label {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.section-label.is-md { font-size: 11px; letter-spacing: 0.24em; }
.section-label.is-neutral { color: var(--vtt-text-muted); }
</style>
