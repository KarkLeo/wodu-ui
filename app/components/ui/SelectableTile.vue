<script setup lang="ts">
const props = withDefaults(defineProps<{
  selected?: boolean
  disabled?: boolean
  /** A display-only tile: a plain element with the same frame, no role; it can hold an `action`. */
  static?: boolean
  /** A mono caption at the top. */
  label?: string
  /** `md` for a card with a glyph and a name, `sm` for a compact value tile. */
  size?: 'md' | 'sm'
}>(), {
  selected: false,
  disabled: false,
  static: false,
  label: undefined,
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
    <span v-if="label || $slots.action" class="sel-tile-head">
      <span class="sel-tile-label">{{ label }}</span>
      <slot v-if="props.static" name="action" />
    </span>
    <slot />
  </component>
</template>

<style scoped>
.sel-tile {
  display: flex;
  flex-direction: column;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  background: rgba(36, 28, 21, 0.4);
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: all var(--t-fast) var(--ease);
}
button.sel-tile { cursor: pointer; }
.sel-tile:hover:not(:disabled) { background: rgba(36, 28, 21, 0.65); }
.sel-tile:disabled { opacity: 0.4; cursor: not-allowed; }
.sel-tile.is-selected {
  background: rgba(140, 106, 58, 0.2);
  border-color: rgba(140, 106, 58, 0.55);
}

.sz-md { padding: 14px 14px 16px; }
.sz-sm { padding: 10px 12px 12px; }

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
</style>
