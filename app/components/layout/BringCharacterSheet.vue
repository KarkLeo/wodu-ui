<script setup lang="ts">
import { computed } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StateNote from '@/components/ui/StateNote.vue'
import ListRow from '@/components/ui/ListRow.vue'
import Avatar from '@/components/ui/Avatar.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useCharactersStore } from '@/stores/characters'
import { currentUser } from '@/transport/auth'
import { moveCharacter } from '@/transport/games'
import type { Character } from '@/types/character'
import { t } from '@/locales'
import { className } from '@/locales/content'
import './game.css'

const props = defineProps<{ gameId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ brought: [id: string] }>()

const characters = useCharactersStore()
const { busy, run } = useGameAction()

// My finished characters that are in no game; a character can be in one game at a time.
const free = computed(() => {
  const me = currentUser.value?.id
  return characters.list.filter((c) => {
    const m = characters.metaOf(c.id)
    return c.status === 'active' && !!me && m?.owner === me && m.game === ''
  })
})

function classLine(c: Character): string {
  const name = c.classId === 'custom'
    ? (c.customClassName ?? t('characterList.customClassFallback'))
    : className(c.classId)
  return t('characterList.classLine', { className: name, level: c.level })
}

async function bring(c: Character) {
  const ok = await run('moveCharacter', t('games.bring.failed'), () => moveCharacter(c.id, props.gameId))
  if (!ok) return
  open.value = false
  emit('brought', c.id)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.bring.title')" :max-width="420">
    <div class="gs-stack">
      <StateNote inline align="start" size="sm">{{ t('games.bring.hint') }}</StateNote>
      <ul v-if="free.length" class="gs-list">
        <li v-for="c in free" :key="c.id">
          <ListRow as="button" :title="c.name" :subtitle="classLine(c)" :disabled="busy" @click="bring(c)">
            <template #leading><Avatar :name="c.name" aria-hidden="true" /></template>
          </ListRow>
        </li>
      </ul>
      <EmptyState v-else :hint="t('games.bring.empty')" />
    </div>
  </BottomSheet>
</template>
