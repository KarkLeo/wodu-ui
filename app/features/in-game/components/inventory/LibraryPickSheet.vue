<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import Button from '@/components/ui/Button.vue'
import IconSearch from '@/components/ui/icons/IconSearch.vue'
import ItemChips from '@/features/item-library/ItemChips.vue'
import ItemKindTabs from '@/features/item-library/ItemKindTabs.vue'
import { useGiveItem } from '@/composables/useGiveItem'
import { searchItems } from '@/domain/library'
import { useCharactersStore } from '@/stores/characters'
import { useLibraryStore } from '@/stores/library'
import { loadItems } from '@/transport/library'
import type { ItemKindFilter, LibraryItem } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ gameId: string; characterId: string }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const library = useLibraryStore()
const characters = useCharactersStore()
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
  const before = characters.getById(props.characterId)
  try {
    await give(props.characterId, item)
  } finally {
    mark(busyIds, item.id, false)
  }
  // give() is silent on a refusal; a delivered item replaces the character object.
  if (characters.getById(props.characterId) === before) return
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
      <p v-if="loading" class="lp-note" role="status">{{ t('library.items.loading') }}</p>

      <div v-else-if="failed" class="lp-note" role="alert">
        <p>{{ t('library.items.loadFailed') }}</p>
        <Button variant="ghost" size="sm" @click="loadItems(gameId)">{{ t('library.items.retry') }}</Button>
      </div>

      <div v-else-if="library.items.length === 0" class="lp-note">
        <p>{{ t('library.items.pick.empty') }}</p>
        <Button variant="ghost" size="sm" @click="toLibrary">{{ t('library.items.pick.emptyLink') }}</Button>
      </div>

      <template v-else>
        <label class="lp-search">
          <IconSearch class="lp-search-icon" aria-hidden="true" />
          <input
            v-model="query"
            class="lp-search-input"
            type="search"
            autocomplete="off"
            :aria-label="t('library.items.search')"
            :placeholder="t('library.items.searchPlaceholder')"
          >
        </label>
        <ItemKindTabs v-model="kind" />

        <p v-if="shown.length === 0" class="lp-note" role="status">
          {{ query.trim() ? t('library.items.noMatches', { query: query.trim() }) : t('library.items.noMatchesKind') }}
        </p>
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

.lp-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  transition: border-color var(--t-fast) var(--ease);
}
.lp-search:focus-within { border-color: var(--vtt-border-gold); }
.lp-search-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--vtt-text-muted); }
.lp-search-input {
  flex: 1;
  min-width: 0;
  padding: 8px 0;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  /* 16px keeps iOS Safari from zooming into the field. */
  font-size: 16px;
}
.lp-search-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }

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

.lp-note {
  margin: 12px auto;
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
.lp-note p { margin: 0; }
</style>
