<script setup lang="ts">
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

function save(e: Event) {
  props.dispatch({ type: 'UPDATE_NOTES', notes: (e.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <section class="panel">
    <div class="label">Заметки</div>
    <textarea class="notes" :value="char.notes" @blur="save" placeholder="Заметки по персонажу, миру, сюжету…"></textarea>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; height: 100%; }
.notes { flex: 1; min-height: 60vh; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 14px; border-radius: 4px; resize: vertical; }
</style>
