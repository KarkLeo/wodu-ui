<script setup lang="ts">
import type { Component } from 'vue'

type Variant = 'primary' | 'hero' | 'hero-danger' | 'ghost' | 'danger-ghost' | 'icon'
type Size = 'sm' | 'base' | 'lg'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  iconLeft?: Component
  iconRight?: Component
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
}>(), {
  variant: 'ghost',
  size: 'base',
  type: 'button',
})

defineEmits<{ (e: 'click', ev: MouseEvent): void }>()
</script>

<template>
  <button
    :class="['btn', `v-${props.variant}`, `sz-${props.size}`]"
    :type="props.type"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    @click="$emit('click', $event)"
  >
    <span v-if="iconLeft" class="btn-icon"><component :is="iconLeft" /></span>
    <span v-if="$slots.default" class="btn-label"><slot /></span>
    <span v-if="iconRight" class="btn-icon"><component :is="iconRight" /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--r-pill);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1;
  cursor: pointer;
  transition:
    background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease),
    filter var(--t-fast) var(--ease);
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.btn-icon :deep(svg) { width: 100%; height: 100%; display: block; }

.sz-sm { padding: 7px 14px; font-size: 12px; }
.sz-lg { padding: 12px 24px; font-size: 14px; }

.v-ghost {
  color: var(--vtt-text-secondary);
  border-color: var(--vtt-border-subtle);
}
.v-ghost:hover:not(:disabled) {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}

.v-primary {
  background: var(--vtt-bg-elevated);
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.v-primary:hover:not(:disabled) {
  background: #2e241a;
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent);
}

.v-hero {
  background: #A6833E;
  color: #1a1205;
  border-color: #8C6A3A;
  font-weight: 600;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.35));
}
.v-hero:hover:not(:disabled) {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}

.v-hero-danger {
  background: var(--vtt-danger);
  color: var(--vtt-text-primary);
  border-color: var(--vtt-danger-bright);
  font-weight: 600;
  filter: drop-shadow(0 0 10px rgba(178, 59, 79, 0.35));
}
.v-hero-danger:hover:not(:disabled) {
  background: var(--vtt-danger-bright);
  border-color: var(--vtt-danger-bright);
  filter: drop-shadow(0 0 14px rgba(178, 59, 79, 0.5));
}

.v-danger-ghost {
  padding: 9px 12px;
  color: var(--vtt-text-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
  gap: 6px;
}
.v-danger-ghost:hover:not(:disabled) {
  color: var(--vtt-danger-bright);
  border-color: var(--vtt-border-subtle);
  background: rgba(178, 59, 79, 0.06);
}

.v-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  justify-content: center;
  border-color: var(--vtt-border-subtle);
  color: var(--vtt-text-secondary);
  border-radius: var(--r-pill);
}
.v-icon:hover:not(:disabled) {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.v-icon .btn-icon { width: 12px; height: 12px; }
</style>
