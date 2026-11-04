<script setup lang="ts">
import IconCheck from './icons/IconCheck.vue'

const props = withDefaults(defineProps<{
  title: string
  /** An italic line under the title. */
  description?: string
  /** `checkbox` for a pick of several, `radio` for a pick of one. */
  type?: 'checkbox' | 'radio'
  selected?: boolean
  /** Chosen for you (granted by the class): drawn and announced as checked, cannot be toggled. */
  locked?: boolean
  /** Cannot be picked now (no slots left). */
  disabled?: boolean
  /** A short mono note at the right end; the `trailing` slot replaces it. */
  flag?: string
}>(), {
  description: undefined,
  type: 'checkbox',
  selected: false,
  locked: false,
  disabled: false,
  flag: undefined,
})

const emit = defineEmits<{ (e: 'toggle'): void }>()

function onClick() {
  if (props.locked || props.disabled) return
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    :class="['sel-row', { 'is-selected': selected && !locked, 'is-locked': locked, 'is-disabled': disabled && !locked }]"
    :role="type"
    :aria-checked="selected || locked"
    :disabled="disabled || locked"
    @click="onClick"
  >
    <span class="sel-row-check" aria-hidden="true">
      <IconCheck v-if="selected || locked" :stroke-width="2" />
    </span>
    <span class="sel-row-body">
      <span class="sel-row-title">{{ title }}</span>
      <span v-if="description" class="sel-row-desc">{{ description }}</span>
    </span>
    <slot name="trailing">
      <span v-if="flag" class="sel-row-flag">{{ flag }}</span>
    </slot>
  </button>
</template>

<style scoped>
.sel-row {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  column-gap: 14px;
  width: 100%;
  padding: 12px 8px;
  background: transparent;
  border: 0;
  border-radius: var(--r-sm);
  text-align: left;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
}
.sel-row + .sel-row { border-top: 1px solid var(--vtt-gold-a10); }
.sel-row:hover:not(:disabled):not(.is-selected) { background: var(--vtt-accent-soft-a03); }
.sel-row.is-selected { background: var(--vtt-gold-a12); }
.sel-row.is-locked { opacity: 0.75; cursor: default; }
.sel-row.is-disabled { opacity: 0.35; cursor: not-allowed; }

.sel-row-check {
  width: 22px;
  height: 22px;
  border-radius: var(--r-pill);
  border: 1px solid var(--vtt-gold-a35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--t-fast) var(--ease);
}
.sel-row.is-selected .sel-row-check {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
}
.sel-row.is-locked .sel-row-check {
  background: var(--vtt-gold-a45);
  border-color: var(--vtt-gold-a55);
  color: var(--vtt-accent-soft);
}

.sel-row-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sel-row-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-text-primary);
  line-height: 1.2;
}
.sel-row-desc {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.35;
}
.sel-row-flag {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  flex-shrink: 0;
}
</style>
