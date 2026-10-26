<script setup lang="ts">
import { watch } from 'vue'
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { t } from '@/locales'
import { useDebouncedField } from '@/composables/useDebouncedField'
import { useSheetReadonly } from '@/composables/useSheetReadonly'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const notes = useDebouncedField(
  () => props.char.notes,
  (value) => props.dispatch({ type: 'UPDATE_NOTES', notes: value }),
  600,
)

const readonly = useSheetReadonly()
// Typing in progress when the sheet turns read-only would only be refused.
watch(readonly, (ro) => { if (ro) notes.discard() })
</script>

<template>
  <section class="notes-section">
    <h2 class="notes-title">{{ t('inGame.notes.title') }}</h2>
    <div v-if="readonly" :class="['notes-text', { 'is-empty': !char.notes }]">{{ char.notes || t('inGame.notes.empty') }}</div>
    <textarea
      v-else
      class="notes-area"
      :value="notes.value.value"
      @input="notes.onInput(($event.target as HTMLTextAreaElement).value)"
      @blur="notes.flush()"
      :placeholder="t('inGame.notes.placeholder')"
    ></textarea>
  </section>
</template>

<style scoped>
.notes-section {
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.notes-title {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--vtt-text-primary);
}
.notes-area {
  flex: 1;
  min-height: 60vh;
  padding: var(--s-3);
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  resize: none;
  transition: border-color var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.notes-text {
  padding: var(--s-3);
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.notes-text.is-empty {
  color: var(--vtt-text-muted);
}
.notes-area::placeholder {
  color: var(--vtt-text-muted);
}
.notes-area:focus {
  outline: none;
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 3px rgba(212, 168, 87, 0.12);
}
</style>
