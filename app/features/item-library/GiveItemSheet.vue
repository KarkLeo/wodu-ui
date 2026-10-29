<script setup lang="ts">
import { computed } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useGiveItem } from '@/composables/useGiveItem'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'
import '@/components/layout/game.css'

const props = defineProps<{ item: LibraryItem | null; gameId: string }>()
const open = defineModel<boolean>('open', { required: true })

const characters = useCharactersStore()
const games = useGamesStore()
const { give } = useGiveItem()

const rows = computed(() => {
  const members = games.membersOf(props.gameId)
  return characters.list
    .filter(c => c.status !== 'draft'
      && characters.metaOf(c.id)?.game === props.gameId
      && characters.canEditCharacter(c.id))
    .map((c) => {
      const owner = characters.metaOf(c.id)?.owner
      const mine = !!owner && owner === currentUser.value?.id
      const ownerName = members.find(m => m.user === owner)?.name ?? ''
      return {
        id: c.id,
        name: c.name,
        owner: mine ? t('library.items.give.ownerMine') : ownerName ? t('library.items.give.ownerPlayer', { name: ownerName }) : '',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

async function pick(characterId: string) {
  const item = props.item
  if (!item) return
  open.value = false
  await give(characterId, item)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('library.items.give.title', { item: item?.name ?? '' })" :max-width="420">
    <div class="gs-stack">
      <p class="gs-hint">{{ t('library.items.give.hint') }}</p>
      <ul v-if="rows.length" class="gs-list">
        <li v-for="r in rows" :key="r.id">
          <button type="button" class="gs-row" @click="pick(r.id)">
            <span class="gs-avatar" aria-hidden="true">{{ r.name.trim().charAt(0).toUpperCase() || '?' }}</span>
            <span class="gs-body">
              <span class="gs-name">{{ r.name }}</span>
              <span v-if="r.owner" class="gs-sub">{{ r.owner }}</span>
            </span>
          </button>
        </li>
      </ul>
      <div v-else class="gs-empty">{{ t('library.items.give.nobody') }}</div>
    </div>
  </BottomSheet>
</template>
