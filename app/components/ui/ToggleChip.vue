<script setup lang="ts">
defineProps<{
  label: string
  pressed: boolean
}>()

defineEmits<{ (e: 'toggle'): void }>()
</script>

<template>
  <button type="button" :class="['toggle-chip', { 'is-on': pressed }]" :aria-pressed="pressed" @click="$emit('toggle')">
    {{ label }}
  </button>
</template>

<style scoped>
.toggle-chip {
  padding: 3px 10px;
  border: 1px dashed var(--vtt-border-strong);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--vtt-text-muted);
  font-family: var(--font-sans);
  font-size: 11px;
  cursor: pointer;
  transition:
    background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}
.toggle-chip:hover { color: var(--vtt-accent-soft); border-color: var(--vtt-border-gold); }
/* The same fill as an accent Pill, so the text contrast is the one already guarded for it. */
.toggle-chip.is-on {
  border-style: solid;
  border-color: transparent;
  background: var(--vtt-bg-elevated);
  background: color-mix(in srgb, var(--vtt-accent-deep) 22%, transparent);
  color: var(--vtt-accent);
}
</style>
