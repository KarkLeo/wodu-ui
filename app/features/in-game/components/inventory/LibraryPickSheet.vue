<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import SearchField from '@/components/ui/SearchField.vue'
import StateNote from '@/components/ui/StateNote.vue'
import ItemChips from '@/features/item-library/ItemChips.vue'
import ItemKindTabs from '@/features/item-library/ItemKindTabs.vue'
import { useGiveItem } from '@/composables/useGiveItem'
import { searchItems } from '@/domain/library'
import { useLibraryStore } from '@/stores/library'
import { loadItems } from '@/transport/library'
import type { ItemKindFilter, LibraryItem } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ gameId: string; characterId: string }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const library = useLibraryStore()
const { give } = useGiveItem()

const query = ref('')
const kind = ref<ItemKindFilter>('all')

// A master who never visited the library screen has nothing in the store yet.
function ensureLoaded() {
  if (library.gameId === props.gameId && (library.status.items === 'ready' || library.status.items === 'loading')) return
  void loadItems(props.gameId)
}
watch(open, (now) => {
  if (now) ensureLoaded()
  else {
    query.value = ''
    kind.value = 'all'
  }
}, { immediate: true })

const forThisGame = computed(() => library.gameId === props.gameId)
const hasList = computed(() => forThisGame.value && (library.status.items === 'ready' || library.items.length > 0))
const failed = computed(() => forThisGame.value && library.status.items === 'failed' && !hasList.value)
const loading = computed(() => !hasList.value && !failed.value)
const shown = computed(() => searchItems(hasList.value ? library.items : [], query.value, kind.value))

// ── Give ──
const GIVEN_MS = 2000
const busyIds = ref<Set<string>>(new Set())
const givenIds = ref<Set<string>>(new Set())
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function mark(set: typeof busyIds, id: string, on: boolean) {
  const next = new Set(set.value)
  if (on) next.add(id)
  else next.delete(id)
  set.value = next
}

async function pick(item: LibraryItem) {
  if (busyIds.value.has(item.id)) return
  mark(busyIds, item.id, true)
  let delivered = false
  try {
    delivered = await give(props.characterId, item, { announce: false })
  } finally {
    mark(busyIds, item.id, false)
  }
  if (!delivered) return
  mark(givenIds, item.id, true)
  clearTimeout(timers.get(item.id))
  timers.set(item.id, setTimeout(() => {
    mark(givenIds, item.id, false)
    timers.delete(item.id)
  }, GIVEN_MS))
}

onBeforeUnmount(() => timers.forEach(clearTimeout))

function toLibrary() {
  open.value = false
  void router.push({ name: 'game-items', params: { gameId: props.gameId } })
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('inGame.inventory.fromLibrary')" :max-width="420">
    <div class="lp-stack">
      <StateNote v-if="loading" compact role="status">{{ t('library.items.loading') }}</StateNote>

      <StateNote v-else-if="failed" compact role="alert">
        {{ t('library.items.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="loadItems(gameId)">{{ t('library.items.retry') }}</Button>
        </template>
      </StateNote>

      <StateNote v-else-if="library.items.length === 0" compact>
        {{ t('library.items.pick.empty') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="toLibrary">{{ t('library.items.pick.emptyLink') }}</Button>
        </template>
      </StateNote>

      <template v-else>
        <SearchField v-model="query" :label="t('library.items.search')" :placeholder="t('library.items.searchPlaceholder')" />
        <ItemKindTabs v-model="kind" />

        <StateNote v-if="shown.length === 0" compact role="status">
          {{ query.trim() ? t('library.items.noMatches', { query: query.trim() }) : t('library.items.noMatchesKind') }}
        </StateNote>
        <ul v-else class="lp-list" :aria-label="t('inGame.inventory.fromLibrary')">
          <li v-for="i in shown" :key="i.id" class="lp-row">
            <span class="lp-name">{{ i.name }}</span>
            <ItemChips :item="i" class="lp-chips" />
            <span v-if="givenIds.has(i.id)" class="lp-given" role="status">{{ t('library.items.pick.given') }}</span>
            <Button v-else variant="primary" size="sm" :disabled="busyIds.has(i.id)" @click="pick(i)">
              {{ t('library.items.give.action') }}
            </Button>
          </li>
        </ul>
      </template>
    </div>
  </BottomSheet>
</template>

<style scoped>
.lp-stack { display: flex; flex-direction: column; gap: var(--s-3); }

.lp-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.lp-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
.lp-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-primary);
}
.lp-given {
  min-width: 56px;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--vtt-success);
}
</style>
