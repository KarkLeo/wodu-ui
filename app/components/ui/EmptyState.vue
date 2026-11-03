<script setup lang="ts">
withDefaults(defineProps<{
  /** Without it the hint alone fills the box, for a one-line empty list. */
  title?: string
  hint?: string
  /** `plain`: no frame and larger text, for a screen or panel that has nothing else to show. */
  variant?: 'box' | 'plain'
}>(), {
  variant: 'box',
})
</script>

<template>
  <div :class="['empty-state', { 'is-plain': variant === 'plain' }]">
    <div v-if="$slots.icon" class="empty-state-icon"><slot name="icon" /></div>
    <p v-if="title" class="empty-state-title">{{ title }}</p>
    <p v-if="hint" class="empty-state-hint">{{ hint }}</p>
    <div v-if="$slots.default" class="empty-state-action"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-md);
}
.empty-state.is-plain {
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  padding: 32px 20px;
  gap: 10px;
  border: 0;
}
.empty-state-icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-accent-deep);
}
.empty-state-icon :slotted(svg) { width: 22px; height: 22px; }
.empty-state-title { margin: 0; font-family: var(--font-serif); font-size: 16px; color: var(--vtt-accent-soft); }
.is-plain .empty-state-title { font-size: 20px; }
.empty-state-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
.is-plain .empty-state-hint { font-size: 14px; line-height: 1.5; }
.empty-state-action { margin-top: 6px; display: flex; justify-content: center; }
</style>
