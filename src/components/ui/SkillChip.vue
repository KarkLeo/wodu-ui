<script setup lang="ts">
import type { Component } from 'vue'

type Mode = 'display' | 'pick-multi' | 'pick-single' | 'add'
type State = 'default' | 'auto' | 'selected' | 'locked'

const props = withDefaults(defineProps<{
  label: string
  mode?: Mode
  state?: State
  icon?: Component
}>(), {
  mode: 'display',
  state: 'default',
})

const emit = defineEmits<{ (e: 'toggle'): void }>()

function onClick() {
  if (props.state === 'locked' || props.state === 'auto') return
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    :class="[
      'skill-chip',
      `mode-${props.mode}`,
      {
        'is-auto': state === 'auto',
        'is-selected': state === 'selected',
        'is-locked': state === 'locked',
      },
    ]"
    :disabled="state === 'locked'"
    :role="mode === 'pick-multi' ? 'checkbox' : mode === 'pick-single' ? 'radio' : undefined"
    :aria-checked="mode === 'pick-multi' || mode === 'pick-single' ? state === 'selected' : undefined"
    @click="onClick"
  >
    <span
      v-if="mode === 'pick-multi' || mode === 'pick-single'"
      class="skill-pick-mark"
    />
    <span v-if="icon" class="skill-chip-glyph"><component :is="icon" /></span>
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.skill-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  user-select: none;
  white-space: nowrap;
}
.skill-chip:hover:not(:disabled):not(.is-auto) {
  border-color: var(--vtt-border-strong);
  background: var(--vtt-bg-surface);
  color: var(--vtt-accent-soft);
}

.skill-chip.mode-pick-multi,
.skill-chip.mode-pick-single {
  padding-left: 10px;
}

.skill-chip.mode-add {
  border-style: dashed;
  color: var(--vtt-text-muted);
  padding: 7px 12px;
}
.skill-chip.mode-add:hover:not(:disabled) {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-border-gold);
  background: rgba(140, 106, 58, 0.05);
}

.skill-chip.is-auto {
  cursor: default;
}
.skill-chip.is-auto .skill-chip-glyph { color: var(--vtt-accent-deep); }

.skill-chip.mode-display { cursor: default; }
.skill-chip.mode-display:hover:not(:disabled):not(.is-auto),
.skill-chip.mode-display:hover {
  border-color: var(--vtt-border-subtle);
  background: transparent;
  color: var(--vtt-text-primary);
}

.skill-chip.is-selected {
  background: var(--vtt-accent-deep);
  border-color: var(--vtt-accent);
  color: var(--vtt-bg-base);
}
.skill-chip.is-selected:hover {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
}

.skill-chip.is-locked {
  border-color: var(--vtt-border-subtle);
  color: var(--vtt-border-strong);
  cursor: not-allowed;
  pointer-events: none;
}

.skill-chip-glyph {
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  opacity: 0.7;
  flex-shrink: 0;
}
.skill-chip-glyph :deep(svg) { width: 100%; height: 100%; display: block; }

.skill-pick-mark {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--vtt-border-strong);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.skill-chip.mode-pick-multi .skill-pick-mark { border-radius: 3px; }
.skill-chip.mode-pick-single .skill-pick-mark { border-radius: var(--r-pill); }

.skill-chip.is-selected .skill-pick-mark {
  border-color: var(--vtt-bg-base);
  background: var(--vtt-bg-base);
}
.skill-chip.mode-pick-single.is-selected .skill-pick-mark::after {
  content: "";
  width: 6px;
  height: 6px;
  background: var(--vtt-accent);
  border-radius: var(--r-pill);
}
.skill-chip.mode-pick-multi.is-selected .skill-pick-mark::after {
  content: "";
  width: 8px;
  height: 4px;
  border: 1.5px solid var(--vtt-accent);
  border-top: 0;
  border-right: 0;
  transform: rotate(-45deg) translate(1px, -1px);
}
</style>
