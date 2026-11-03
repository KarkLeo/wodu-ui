<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** `button` or `a` / RouterLink for a row that acts, `div` / `li` for a static one. */
  as?: string | Component
  /**
   * `plain` a borderless row (avatar, name, sub line) in a panel or a sheet;
   * `card` a framed card in a list of its own; `dashed` the card of something unfinished (a draft).
   */
  variant?: 'plain' | 'card' | 'dashed'
  title?: string
  subtitle?: string
  /** `accent` for a sub line that is the row's call to action ("Resume →"). */
  subtitleTone?: 'neutral' | 'accent'
  /** An italic line under the sub line (cards only need it so far). */
  note?: string
  selected?: boolean
  /** A button row that toggles something (a sheet it opens) sets this; it becomes `aria-pressed`. */
  pressed?: boolean
  /** A disabled link row renders without its link, so it neither navigates nor takes the focus. */
  disabled?: boolean
}>(), {
  as: 'div',
  variant: 'plain',
  subtitleTone: 'neutral',
  selected: false,
  // Left out unless set, so a row that toggles nothing carries no aria-pressed.
  pressed: undefined,
  disabled: false,
})

const slots = useSlots()
const attrs = useAttrs()

const isButton = computed(() => props.as === 'button')
const interactive = computed(() => typeof props.as !== 'string' || props.as === 'button' || props.as === 'a')
const disabledLink = computed(() => props.disabled && interactive.value && !isButton.value)

// A disabled link becomes an `<a>` without href, RouterLink `to` or click handlers.
function rootAttrs() {
  if (!disabledLink.value) return attrs
  const { href: _href, to: _to, onClick: _onClick, ...rest } = attrs
  return { ...rest, role: 'link' }
}
// A card keeps its trailing piece on the title line; a plain row gives it a column of its own.
const trailingInHead = computed(() => props.variant !== 'plain')
</script>

<template>
  <component
    :is="disabledLink ? 'a' : as"
    v-bind="rootAttrs()"
    :type="isButton ? 'button' : undefined"
    :disabled="isButton ? disabled : undefined"
    :aria-disabled="!isButton && disabled ? 'true' : undefined"
    :aria-pressed="isButton ? pressed : undefined"
    :class="[
      'list-row',
      `is-${variant === 'plain' ? 'plain' : 'card'}`,
      {
        'is-dashed': variant === 'dashed',
        'is-interactive': interactive,
        'is-selected': selected,
        'is-disabled': disabled,
        'has-leading': !!slots.leading,
        'has-trailing': !!slots.trailing && !trailingInHead,
      },
    ]"
  >
    <span v-if="slots.leading" class="lr-leading"><slot name="leading" /></span>
    <span class="lr-main">
      <span class="lr-head">
        <span class="lr-title"><slot name="title">{{ title }}</slot></span>
        <span v-if="slots.trailing && trailingInHead" class="lr-head-trailing"><slot name="trailing" /></span>
      </span>
      <span
        v-if="subtitle || slots.subtitle"
        :class="['lr-subtitle', { 'is-accent': subtitleTone === 'accent' }]"
      ><slot name="subtitle">{{ subtitle }}</slot></span>
      <span v-if="note" class="lr-note">{{ note }}</span>
      <slot />
    </span>
    <span v-if="slots.trailing && !trailingInHead" class="lr-trailing"><slot name="trailing" /></span>
    <span v-if="slots.below" class="lr-below"><slot name="below" /></span>
  </component>
</template>

<style scoped>
.list-row {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  text-decoration: none;
}
.list-row.has-leading { grid-template-columns: auto minmax(0, 1fr); }
.list-row.has-trailing { grid-template-columns: minmax(0, 1fr) auto; }
.list-row.has-leading.has-trailing { grid-template-columns: auto minmax(0, 1fr) auto; }

.lr-leading { display: inline-flex; }
.lr-main { min-width: 0; display: flex; flex-direction: column; }
.lr-head { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.lr-title {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-serif);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lr-subtitle {
  font-family: var(--font-mono);
  color: var(--vtt-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lr-subtitle.is-accent { color: var(--vtt-accent-soft); }
.lr-trailing { display: inline-flex; align-items: center; gap: 6px; }
/* Under the text, out to the right end: actions, a bar. */
.lr-below { grid-column: 1 / -1; min-width: 0; }
.list-row.has-leading .lr-below { grid-column: 2 / -1; }

/* ── plain ── */
.list-row.is-plain {
  column-gap: 12px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  line-height: 1.5;
}
.is-plain .lr-main { gap: 1px; }
.is-plain .lr-title { font-size: 15px; line-height: 1.2; color: var(--vtt-accent-soft); }
.is-plain .lr-subtitle { font-size: 10px; letter-spacing: 0.1em; }

/* Each tint is preceded by a plain token for browsers without color-mix() (iOS Safari before 16.2). */
.is-plain.is-interactive { cursor: pointer; transition: background var(--t-fast) var(--ease); }
.is-plain.is-interactive:hover:not(.is-disabled) {
  background: var(--vtt-bg-surface);
  background: color-mix(in srgb, var(--vtt-accent-soft) 4%, transparent);
}
.list-row.is-plain.is-selected {
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-accent) 8%, transparent);
}

/* ── card / dashed ── */
.list-row.is-card {
  padding: 14px 16px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
  line-height: normal;
}
.is-card .lr-main { gap: 6px; }
.is-card .lr-title { font-weight: 500; font-size: 19px; line-height: 1.15; color: var(--vtt-text-primary); }
.is-card .lr-subtitle { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.is-card .lr-note { font-family: var(--font-serif); font-style: italic; font-size: 13px; color: var(--vtt-text-secondary); }
.lr-head-trailing { flex-shrink: 0; max-width: 55%; display: inline-flex; min-width: 0; }
.is-card.is-interactive {
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}
.is-card.is-interactive:hover:not(.is-disabled) { border-color: var(--vtt-border-strong); background: var(--vtt-bg-elevated); }
.list-row.is-card.is-selected { border-color: var(--vtt-border-gold); }
.list-row.is-dashed { opacity: 0.7; border-style: dashed; background: transparent; }
.list-row.is-dashed.is-interactive:hover:not(.is-disabled) { opacity: 1; background: var(--vtt-bg-surface); }

.list-row.is-disabled { opacity: 0.5; cursor: not-allowed; }
</style>
