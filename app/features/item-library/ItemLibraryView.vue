<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconSearch from '@/components/ui/icons/IconSearch.vue'
import GiveItemSheet from './GiveItemSheet.vue'
import ItemKindTabs from './ItemKindTabs.vue'
import ItemRow from './ItemRow.vue'
import ItemSheet, { type ItemDraft, type ItemSheetMode } from './ItemSheet.vue'
import { useGameAction } from '@/composables/useGameAction'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { searchItems } from '@/domain/library'
import { useLibraryStore } from '@/stores/library'
import { connection } from '@/transport/connection'
import { createItem, deleteItem, loadItems, updateItem } from '@/transport/library'
import type { ItemKindFilter, LibraryItem } from '@/types/library'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const log = createLogger('item-library')

const router = useRouter()
const { game, gameId, tableRoute } = useTable()
const library = useLibraryStore()
const { busy, run } = useGameAction()

// Only the master loads: a player who opened the address is on the way back to the table.
const masterOf = computed(() => (game.value && isGameMaster(game.value.id) ? game.value.id : null))
watch(masterOf, (id) => {
  if (id) void loadItems(id)
}, { immediate: true })

// Back from a server outage: the master's other device may have changed the library meanwhile.
watch(connection, (now, was) => {
  if (was === 'down' && now === 'ok' && masterOf.value) void loadItems(masterOf.value)
})

const forThisGame = computed(() => !!masterOf.value && library.gameId === masterOf.value)
// A reload keeps the list on screen; anything else (idle, another game, a first load) waits.
const hasList = computed(() => forThisGame.value && (library.status.items === 'ready' || library.items.length > 0))
const failed = computed(() => forThisGame.value && library.status.items === 'failed')
const loading = computed(() => !hasList.value && !failed.value)

const query = ref('')
const kind = ref<ItemKindFilter>('all')
const shown = computed(() => searchItems(hasList.value ? library.items : [], query.value, kind.value))
const expandedId = ref<string | null>(null)

// ── Add / edit / duplicate ──
const sheetOpen = ref(false)
const sheetMode = ref<ItemSheetMode>('add')
const sheetSource = ref<LibraryItem | null>(null)
const saving = ref(false)
const saveFailed = ref(false)

function openSheet(mode: ItemSheetMode, source: LibraryItem | null = null) {
  sheetMode.value = mode
  sheetSource.value = source
  saveFailed.value = false
  sheetOpen.value = true
}

async function save(draft: ItemDraft) {
  const id = gameId.value
  if (!id || saving.value) return
  const editing = sheetMode.value === 'edit' ? sheetSource.value : null
  const item: LibraryItem = { ...draft, id: editing?.id ?? crypto.randomUUID() }
  saving.value = true
  saveFailed.value = false
  try {
    if (editing) await updateItem(id, item)
    else await createItem(id, item)
    sheetOpen.value = false
    expandedId.value = item.id
  } catch (err) {
    // The sheet stays open with what was typed and says so; a lost connection also raises the overlay.
    log.warn('saving an item failed', { err })
    saveFailed.value = true
  } finally {
    saving.value = false
  }
}

// ── Give ──
const giving = ref<LibraryItem | null>(null)
const giveOpen = ref(false)

function openGive(item: LibraryItem) {
  giving.value = item
  giveOpen.value = true
}

// ── Delete ──
const deleting = ref<LibraryItem | null>(null)
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (v) => { if (!v) deleting.value = null },
})

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  const id = gameId.value
  if (!id) return
  const ok = await run('deleteItem', t('library.items.remove.failed'), () => deleteItem(id, target.id))
  if (ok) deleting.value = null
}

function retry() {
  if (masterOf.value) void loadItems(masterOf.value)
}

function backToTable() {
  void router.push(tableRoute())
}
</script>

<template>
  <div class="content-wrap il-screen">
    <header class="il-head">
      <div class="il-titles">
        <h1 class="il-title">{{ t('library.items.title') }}</h1>
        <p v-if="game" class="il-game">{{ game.name }}</p>
      </div>
      <Button variant="ghost" size="sm" @click="backToTable">{{ t('library.items.back') }}</Button>
    </header>

    <div v-if="loading" class="il-note" role="status">{{ t('library.items.loading') }}</div>

    <div v-else-if="!hasList" class="il-note" role="alert">
      <p>{{ t('library.items.loadFailed') }}</p>
      <Button variant="ghost" size="sm" @click="retry">{{ t('library.items.retry') }}</Button>
    </div>

    <template v-else>
      <div v-if="failed" class="il-stale" role="alert">
        <p>{{ t('library.items.loadFailed') }}</p>
        <Button variant="ghost" size="sm" @click="retry">{{ t('library.items.retry') }}</Button>
      </div>

      <div class="il-toolbar">
        <label class="il-search">
          <IconSearch class="il-search-icon" aria-hidden="true" />
          <input
            v-model="query"
            class="il-search-input"
            type="search"
            autocomplete="off"
            :aria-label="t('library.items.search')"
            :placeholder="t('library.items.searchPlaceholder')"
          >
        </label>
        <Button variant="primary" size="sm" :icon-left="IconPlus" @click="openSheet('add')">{{ t('library.items.add') }}</Button>
      </div>

      <ItemKindTabs v-if="library.items.length > 0" v-model="kind" />

      <div v-if="library.items.length === 0" class="il-empty">
        <p class="il-empty-title">{{ t('library.items.empty') }}</p>
        <p class="il-empty-hint">{{ t('library.items.emptyHint') }}</p>
      </div>

      <p v-else-if="shown.length === 0" class="il-note" role="status">
        {{ query.trim() ? t('library.items.noMatches', { query: query.trim() }) : t('library.items.noMatchesKind') }}
      </p>

      <ul v-else class="il-list" :aria-label="t('library.items.title')">
        <ItemRow
          v-for="i in shown"
          :key="i.id"
          :item="i"
          :expanded="expandedId === i.id"
          @update:expanded="v => expandedId = v ? i.id : null"
          @give="openGive(i)"
          @edit="openSheet('edit', i)"
          @duplicate="openSheet('duplicate', i)"
          @delete="deleting = i"
        />
      </ul>
    </template>

    <ItemSheet
      v-model:open="sheetOpen"
      :mode="sheetMode"
      :source="sheetSource"
      :saving="saving"
      :failed="saveFailed"
      @save="save"
    />

    <GiveItemSheet v-if="gameId" v-model:open="giveOpen" :item="giving" :game-id="gameId" />

    <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('library.items.remove.title', { name: deleting?.name ?? '' })">
      <p>{{ t('library.items.remove.body') }}</p>
      <template #actions>
        <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('library.items.remove.confirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </div>
</template>

<style scoped>
.il-screen {
  /* Same column as the game settings: centred, never under GameLayout's side panels. */
  --il-w: min(640px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--il-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--il-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--il-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.il-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.il-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.il-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.il-game {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.il-toolbar { display: flex; align-items: center; gap: 10px; }
.il-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  transition: border-color var(--t-fast) var(--ease);
}
.il-search:focus-within { border-color: var(--vtt-border-gold); }
.il-search-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--vtt-text-muted); }
.il-search-input {
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
.il-search-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }

.il-stale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--vtt-danger);
  border-radius: var(--r-sm);
  background: var(--vtt-danger-soft);
}
.il-stale p { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }

.il-list { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

.il-note {
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
.il-note p { margin: 0; }

.il-empty {
  padding: 24px 18px;
  text-align: center;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-md);
}
.il-empty-title { margin: 0 0 6px; font-family: var(--font-serif); font-size: 16px; color: var(--vtt-accent-soft); }
.il-empty-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
</style>
