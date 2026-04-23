<script setup lang="ts">
type Mode = 'reference' | 'pick-multi' | 'pick-single' | 'display'
type State = 'default' | 'selected' | 'locked'

const props = withDefaults(defineProps<{
  title: string
  level?: number | string
  mode?: Mode
  variant?: 'default' | 'reference'
  state?: State
}>(), {
  mode: 'display',
  variant: 'default',
  state: 'default',
})

const emit = defineEmits<{ (e: 'toggle'): void }>()

const isPick = () => props.mode === 'pick-multi' || props.mode === 'pick-single'

function onClick() {
  if (props.state === 'locked' || !isPick()) return
  emit('toggle')
}
</script>

<template>
  <div
    :class="[
      'ability-card',
      `mode-${props.mode}`,
      `variant-${props.variant}`,
      { 'mode-pick': isPick(), 'is-selected': state === 'selected', 'is-locked': state === 'locked' },
    ]"
    :role="mode === 'pick-multi' ? 'checkbox' : mode === 'pick-single' ? 'radio' : undefined"
    :aria-checked="isPick() ? state === 'selected' : undefined"
    :tabindex="isPick() && state !== 'locked' ? 0 : undefined"
    @click="onClick"
    @keydown.space.prevent="onClick"
    @keydown.enter.prevent="onClick"
  >
    <div class="ability-head">
      <span v-if="isPick()" class="ability-head-mark" />
      <div class="ability-head-title">
        <span class="ability-head-title-text">{{ title }}</span>
        <span v-if="level !== undefined" class="ability-level-badge">{{ level }}</span>
      </div>
    </div>
    <div v-if="$slots.default || $slots.actions" class="ability-body">
      <slot />
      <div v-if="$slots.actions" class="ability-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ability-card {
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  overflow: hidden;
  transition: border-color var(--t-fast) var(--ease);
}
.ability-card:hover { border-color: var(--vtt-border-strong); }
.ability-card.mode-pick { cursor: pointer; }

.ability-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 12px 16px 8px;
  user-select: none;
}
.ability-card.mode-pick .ability-head {
  grid-template-columns: auto minmax(0, 1fr);
}

.ability-head-mark {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--vtt-border-strong);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.ability-card.mode-pick-multi .ability-head-mark { border-radius: 3px; }
.ability-card.mode-pick-single .ability-head-mark { border-radius: var(--r-pill); }

.ability-head-title {
  font-family: var(--font-serif);
  font-size: 16px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  letter-spacing: 0.01em;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.ability-head-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ability-level-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  padding: 2px 6px;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  flex-shrink: 0;
  line-height: 1.2;
}

.ability-body {
  padding: 0 16px 14px;
  color: var(--vtt-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  display: block;
}

.ability-actions {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--vtt-border-subtle);
  margin-top: 10px;
}

.ability-card.is-selected {
  border-color: var(--vtt-border-gold);
  background: rgba(140, 106, 58, 0.06);
}
.ability-card.is-selected .ability-head-mark {
  border-color: var(--vtt-accent);
  background: var(--vtt-accent);
}
.ability-card.mode-pick-single.is-selected .ability-head-mark::after {
  content: "";
  width: 8px;
  height: 8px;
  background: var(--vtt-bg-base);
  border-radius: var(--r-pill);
}
.ability-card.mode-pick-multi.is-selected .ability-head-mark::after {
  content: "";
  width: 10px;
  height: 5px;
  border: 1.5px solid var(--vtt-bg-base);
  border-top: 0;
  border-right: 0;
  transform: rotate(-45deg) translate(0, -1px);
}

.ability-card.is-locked {
  opacity: 0.45;
  pointer-events: none;
}
.ability-card.is-locked .ability-head-title { color: var(--vtt-text-muted); }
.ability-card.is-locked .ability-head-mark { border-style: dashed; }

.ability-card.variant-reference {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--vtt-border-subtle);
  border-radius: 0;
}
.ability-card.variant-reference:last-child { border-bottom: none; }
.ability-card.variant-reference .ability-head {
  padding: 10px 0 4px;
  cursor: default;
}
.ability-card.variant-reference .ability-body {
  display: block;
  padding: 0 0 10px;
}
.ability-card.variant-reference .ability-head-title { font-size: 14px; }
</style>
