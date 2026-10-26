<script setup lang="ts">
import { computed } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
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
      <p class="gs-hint">{{ t('games.bring.hint') }}</p>
      <ul v-if="free.length" class="gs-list">
        <li v-for="c in free" :key="c.id">
          <button type="button" class="gs-row" :disabled="busy" @click="bring(c)">
            <span class="gs-avatar" aria-hidden="true">{{ c.name.trim().charAt(0).toUpperCase() || '?' }}</span>
            <span class="gs-body">
              <span class="gs-name">{{ c.name }}</span>
              <span class="gs-sub">{{ classLine(c) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <div v-else class="gs-empty">{{ t('games.bring.empty') }}</div>
    </div>
  </BottomSheet>
</template>
