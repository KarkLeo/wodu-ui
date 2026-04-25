<script setup lang="ts">
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { t } from '@/locales'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

function save(e: Event) {
  props.dispatch({ type: 'UPDATE_NOTES', notes: (e.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <section class="notes-section">
    <h2 class="notes-title">{{ t('inGame.notes.title') }}</h2>
    <textarea
      class="notes-area"
      :value="char.notes"
      @blur="save"
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
.notes-area::placeholder {
  color: var(--vtt-text-muted);
}
.notes-area:focus {
  outline: none;
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 3px rgba(212, 168, 87, 0.12);
}
</style>
