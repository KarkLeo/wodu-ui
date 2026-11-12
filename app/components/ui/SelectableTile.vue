<script setup lang="ts">
const props = withDefaults(defineProps<{
  selected?: boolean
  disabled?: boolean
  /** A display-only tile: a plain element with the same frame, no role; only this form shows `#action`. */
  static?: boolean
  /** A mono caption at the top. */
  label?: string
  /** A large number under the caption (a stat); the default slot then sits beside it as a note. */
  value?: string
  /** Colour of `value`. A selected tile always draws it in `accent`. */
  valueTone?: 'neutral' | 'muted' | 'accent'
  /** `md` for a card with a glyph and a name, `sm` for a compact value tile, `compact` for a picture with a line under it. */
  size?: 'md' | 'sm' | 'compact'
}>(), {
  selected: false,
  disabled: false,
  static: false,
  label: undefined,
  value: undefined,
  valueTone: 'neutral',
  size: 'md',
})

const emit = defineEmits<{ (e: 'select'): void }>()

function onClick() {
  if (props.static || props.disabled) return
  emit('select')
}
</script>

<template>
  <component
    :is="props.static ? 'div' : 'button'"
    :type="props.static ? undefined : 'button'"
    :class="['sel-tile', `sz-${size}`, { 'is-selected': selected && !props.static, 'is-static': props.static }]"
    :role="props.static ? undefined : 'radio'"
    :aria-checked="props.static ? undefined : selected"
    :disabled="props.static ? undefined : disabled"
    @click="onClick"
  >
    <span v-if="label || (props.static && $slots.action)" class="sel-tile-head">
      <span class="sel-tile-label">{{ label }}</span>
      <slot v-if="props.static" name="action" />
    </span>
    <span v-if="value !== undefined" :class="['sel-tile-value', `vt-${valueTone}`]">
      <span class="sel-tile-number">{{ value }}</span>
      <slot />
    </span>
    <slot v-else />
  </component>
</template>

<style scoped>
.sel-tile {
  display: flex;
  flex-direction: column;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  background: var(--vtt-elevated-a40);
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: all var(--t-fast) var(--ease);
}
button.sel-tile { cursor: pointer; }
.sel-tile:hover:not(:disabled):not(.is-selected) { background: var(--vtt-elevated-a65); }
.sel-tile:disabled { opacity: 0.4; cursor: not-allowed; }
.sel-tile.is-selected {
  background: var(--vtt-gold-a20);
  border-color: var(--vtt-gold-a55);
}

.sz-md { padding: 14px 14px 16px; }
.sz-sm { padding: 10px 12px 12px; }
.sz-compact { padding: 6px; gap: 6px; }

.sel-tile-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 8px;
}
.sel-tile-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}

.sel-tile-value {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}
.sel-tile-number {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.vt-muted .sel-tile-number { color: var(--vtt-text-muted); }
.vt-accent .sel-tile-number,
.is-selected .sel-tile-number {
  color: var(--vtt-accent);
  text-shadow: 0 0 12px var(--vtt-accent-a40);
}
</style>
