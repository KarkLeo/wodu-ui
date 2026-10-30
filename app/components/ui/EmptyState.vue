<script setup lang="ts">
defineProps<{
  title: string
  hint?: string
}>()
</script>

<template>
  <div class="empty-state">
    <p class="empty-state-title">{{ title }}</p>
    <p v-if="hint" class="empty-state-hint">{{ hint }}</p>
    <div v-if="$slots.default" class="empty-state-action"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 24px 18px;
  text-align: center;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-md);
}
.empty-state-title { margin: 0; font-family: var(--font-serif); font-size: 16px; color: var(--vtt-accent-soft); }
.empty-state-hint {
  margin: 6px 0 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
.empty-state-action { margin-top: var(--s-3); display: flex; justify-content: center; }
</style>
