<script setup lang="ts">
defineProps<{
  /** Less room around it, for a note inside a sheet. */
  compact?: boolean
}>()
</script>

<template>
  <div :class="['state-note', { 'is-compact': compact }]">
    <p class="state-note-text"><slot /></p>
    <slot name="action" />
  </div>
</template>

<style scoped>
.state-note {
  margin: 32px auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
}
.state-note.is-compact { margin: 12px auto; padding: 0; }
.state-note-text { margin: 0; }
</style>
