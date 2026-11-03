<script setup lang="ts">
withDefaults(defineProps<{
  /** Less room around it, for a note inside a sheet. */
  compact?: boolean
  /** No room around it at all: a hint in the flow of a form, a sheet, a card or a popover. */
  inline?: boolean
  align?: 'center' | 'start'
  /** `md` 14px for a screen, `sm` 13px for a panel or sheet, `xs` 12px for a footnote. */
  size?: 'md' | 'sm' | 'xs'
}>(), {
  align: 'center',
  size: 'md',
})
</script>

<template>
  <div :class="['state-note', `is-${size}`, { 'is-compact': compact, 'is-inline': inline, 'is-start': align === 'start' }]">
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
.state-note.is-sm { font-size: 13px; }
.state-note.is-xs { font-size: 12px; }
.state-note.is-compact { margin: 12px auto; padding: 0; }
.state-note.is-inline { margin: 0; padding: 0; gap: 8px; line-height: 1.45; }
.state-note.is-start { align-items: flex-start; text-align: left; }
.state-note-text { margin: 0; }
</style>
