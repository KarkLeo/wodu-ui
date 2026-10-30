<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ScreenColumn from '@/components/layout/ScreenColumn.vue'
import ScreenHeader from '@/components/layout/ScreenHeader.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import SearchField from '@/components/ui/SearchField.vue'
import StateNote from '@/components/ui/StateNote.vue'
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
    else {
      await createItem(id, item)
      if (searchItems([item], query.value, kind.value).length === 0) {
        query.value = ''
        kind.value = 'all'
      }
    }
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
  <ScreenColumn>
    <ScreenHeader :title="t('library.items.title')" :subtitle="game?.name">
      <template #actions>
        <Button variant="ghost" size="sm" @click="backToTable">{{ t('library.items.back') }}</Button>
      </template>
    </ScreenHeader>

    <StateNote v-if="loading" role="status">{{ t('library.items.loading') }}</StateNote>

    <StateNote v-else-if="!hasList" role="alert">
      {{ t('library.items.loadFailed') }}
      <template #action>
        <Button variant="ghost" size="sm" @click="retry">{{ t('library.items.retry') }}</Button>
      </template>
    </StateNote>

    <template v-else>
      <AlertBanner v-if="failed">
        {{ t('library.items.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retry">{{ t('library.items.retry') }}</Button>
        </template>
      </AlertBanner>

      <div class="il-toolbar">
        <SearchField v-model="query" class="il-search" :label="t('library.items.search')" :placeholder="t('library.items.searchPlaceholder')" />
        <Button variant="primary" size="sm" :icon-left="IconPlus" @click="openSheet('add')">{{ t('library.items.add') }}</Button>
      </div>

      <ItemKindTabs v-if="library.items.length > 0" v-model="kind" />

      <EmptyState v-if="library.items.length === 0" :title="t('library.items.empty')" :hint="t('library.items.emptyHint')" />

      <StateNote v-else-if="shown.length === 0" role="status">
        {{ query.trim() ? t('library.items.noMatches', { query: query.trim() }) : t('library.items.noMatchesKind') }}
      </StateNote>

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
  </ScreenColumn>
</template>

<style scoped>
.il-toolbar { display: flex; align-items: center; gap: 10px; }
.il-search { flex: 1; }
.il-list { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
</style>
