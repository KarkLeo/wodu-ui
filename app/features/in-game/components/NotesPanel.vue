<script setup lang="ts">
import { watch } from 'vue'
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import TextareaField from '@/components/ui/TextareaField.vue'
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
    <SectionHeader variant="heading" as="h2" :title="t('inGame.notes.title')" />
    <div v-if="readonly" :class="['notes-text', { 'is-empty': !char.notes }]">{{ char.notes || t('inGame.notes.empty') }}</div>
    <TextareaField
      v-else
      class="notes-field"
      :model-value="notes.value.value"
      hide-label
      :label="t('inGame.notes.placeholder')"
      :placeholder="t('inGame.notes.placeholder')"
      @update:model-value="notes.onInput"
      @blur="notes.flush()"
    />
  </section>
</template>

<style scoped>
.notes-section {
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
/* The notes are the whole tab: a tall page to write on. */
.notes-field :deep(.form-field-control) { min-height: 60vh; line-height: 1.55; }
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
</style>
