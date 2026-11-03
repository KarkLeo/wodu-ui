<script setup lang="ts">
withDefaults(defineProps<{
  /** `danger` a failure, `warning` a rule being bent, `accent` something to act on, `neutral` plain information. */
  tone?: 'danger' | 'warning' | 'accent' | 'neutral'
  /** Small mono label above the title. */
  eyebrow?: string
  title?: string
  /** The action goes under the text instead of beside it, for a narrow column. */
  stacked?: boolean
  /** No frame: a warning line inside a card that already has one. */
  inline?: boolean
  /** Announce it as an alert. Off for a standing notice that is part of the layout. */
  announce?: boolean
  /** The element to render, e.g. `section` or `aside` with an `aria-label` for a landmark. */
  as?: 'div' | 'section' | 'aside'
}>(), {
  tone: 'danger',
  announce: true,
  as: 'div',
})
</script>

<template>
  <component
    :is="as"
    :class="['alert-banner', `is-${tone}`, { 'is-stacked': stacked, 'is-inline': inline }]"
    :role="announce ? 'alert' : undefined"
  >
    <span v-if="$slots.icon" class="alert-banner-icon"><slot name="icon" /></span>
    <div class="alert-banner-body">
      <p v-if="eyebrow" class="alert-banner-eyebrow">{{ eyebrow }}</p>
      <p v-if="title" class="alert-banner-title">{{ title }}</p>
      <p v-if="$slots.default" class="alert-banner-text"><slot /></p>
    </div>
    <slot name="action" />
  </component>
</template>

<style scoped>
.alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--vtt-danger);
  border-radius: var(--r-sm);
  background: var(--vtt-danger-soft);
}
.alert-banner.is-warning {
  border-color: color-mix(in srgb, var(--vtt-warning) 35%, transparent);
  border-left: 2px solid var(--vtt-warning);
  background: color-mix(in srgb, var(--vtt-warning) 8%, transparent);
}
.alert-banner.is-accent {
  border-color: var(--vtt-border-gold);
  background: color-mix(in srgb, var(--vtt-accent) 6%, transparent);
}
.alert-banner.is-neutral {
  border-color: var(--vtt-border-strong);
  background: color-mix(in srgb, var(--vtt-bg-surface) 90%, transparent);
}
.alert-banner.is-stacked { flex-direction: column; align-items: flex-start; gap: 8px; }
.alert-banner.is-inline {
  align-items: flex-start;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
}

.alert-banner-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  color: var(--vtt-danger-bright);
}
.is-warning .alert-banner-icon { color: var(--vtt-warning); }
.is-accent .alert-banner-icon,
.is-neutral .alert-banner-icon { color: var(--vtt-accent-deep); }
.is-inline .alert-banner-icon { width: 12px; height: 12px; margin-top: 3px; }
.alert-banner-icon :slotted(svg) { width: 100%; height: 100%; }

.alert-banner-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.is-stacked .alert-banner-body { width: 100%; flex: none; }
.alert-banner-eyebrow {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.alert-banner-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
  overflow-wrap: anywhere;
}
.is-danger .alert-banner-title { color: var(--vtt-danger-bright); }
.alert-banner-text { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
.is-warning .alert-banner-text,
.is-accent .alert-banner-text,
.is-neutral .alert-banner-text { color: var(--vtt-text-secondary); }
.alert-banner-title + .alert-banner-text { font-style: italic; color: var(--vtt-text-muted); }
.is-inline .alert-banner-text { font-size: 12px; }
.is-warning .alert-banner-text :slotted(b) { color: var(--vtt-warning); }
</style>
