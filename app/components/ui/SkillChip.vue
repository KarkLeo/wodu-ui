<script setup lang="ts">
import { computed, type Component } from 'vue'

type Mode = 'display' | 'pick-multi' | 'add'
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

const isPick = computed(() => props.mode === 'pick-multi')

function onClick() {
  if (props.state === 'locked' || props.state === 'auto') return
  emit('toggle')
}
</script>

<template>
  <component
    :is="mode === 'display' ? 'span' : 'button'"
    :type="mode === 'display' ? undefined : 'button'"
    :class="[
      'skill-chip',
      `mode-${props.mode}`,
      {
        'is-auto': state === 'auto',
        'is-selected': state === 'selected',
        'is-locked': state === 'locked',
      },
    ]"
    :disabled="mode === 'display' ? undefined : state === 'locked' || (isPick && state === 'auto')"
    :role="isPick ? 'checkbox' : undefined"
    :aria-checked="isPick ? state === 'selected' || state === 'auto' : undefined"
    @click="mode !== 'display' && onClick()"
  >
    <!-- A granted pick is checked and fixed: its lock icon takes the mark's place. -->
    <span v-if="isPick && state !== 'auto'" class="skill-pick-mark" />
    <span v-if="icon" class="skill-chip-glyph"><component :is="icon" /></span>
    <span>{{ label }}</span>
  </component>
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

.skill-chip.mode-pick-multi {
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
  background: var(--vtt-gold-a05);
}

.skill-chip.mode-display { cursor: default; }
.skill-chip.mode-display:hover:not(:disabled):not(.is-auto),
.skill-chip.mode-display:hover {
  border-color: var(--vtt-border-subtle);
  background: transparent;
  color: var(--vtt-text-primary);
}

.skill-chip.is-auto,
.skill-chip.is-auto:hover {
  border-color: var(--vtt-accent-deep);
  cursor: default;
}
/* The lock is drawn small inside its box; at 12px and 0.7 opacity it read as a speck. */
.skill-chip.is-auto .skill-chip-glyph {
  width: 14px;
  height: 14px;
  color: var(--vtt-accent-deep);
  opacity: 1;
}

/* Same weight as a class-granted chip: a picked skill and a granted one both belong to the character. */
.skill-chip.is-selected {
  border-color: var(--vtt-accent-deep);
  color: var(--vtt-text-primary);
}
.skill-chip.is-selected:hover:not(:disabled) {
  border-color: var(--vtt-border-gold);
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

.skill-chip.is-selected .skill-pick-mark {
  border-color: var(--vtt-accent-deep);
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
