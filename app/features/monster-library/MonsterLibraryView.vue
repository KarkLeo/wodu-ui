<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconSearch from '@/components/ui/icons/IconSearch.vue'
import MonsterRow from './MonsterRow.vue'
import MonsterSheet, { type MonsterDraft, type MonsterSheetMode } from './MonsterSheet.vue'
import { useGameAction } from '@/composables/useGameAction'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { searchMonsters } from '@/domain/library'
import { useLibraryStore } from '@/stores/library'
import { connection } from '@/transport/connection'
import { createMonster, deleteMonster, loadMonsters, updateMonster } from '@/transport/library'
import type { LibraryMonster } from '@/types/library'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const log = createLogger('monster-library')

const router = useRouter()
const { game, gameId, tableRoute } = useTable()
const library = useLibraryStore()
const { busy, run } = useGameAction()

// Only the master loads: a player who opened the address is on the way back to the table.
const masterOf = computed(() => (game.value && isGameMaster(game.value.id) ? game.value.id : null))
watch(masterOf, (id) => {
  if (id) void loadMonsters(id)
}, { immediate: true })

// Back from a server outage: the master's other device may have changed the library meanwhile.
watch(connection, (now, was) => {
  if (was === 'down' && now === 'ok' && masterOf.value) void loadMonsters(masterOf.value)
})

const forThisGame = computed(() => !!masterOf.value && library.gameId === masterOf.value)
// A reload keeps the list on screen; anything else (idle, another game, a first load) waits.
const hasList = computed(() => forThisGame.value && (library.status === 'ready' || library.monsters.length > 0))
const failed = computed(() => forThisGame.value && library.status === 'failed')
const loading = computed(() => !hasList.value && !failed.value)

const query = ref('')
const shown = computed(() => searchMonsters(hasList.value ? library.monsters : [], query.value))
const expandedId = ref<string | null>(null)

// ── Add / edit / duplicate ──
const sheetOpen = ref(false)
const sheetMode = ref<MonsterSheetMode>('add')
const sheetSource = ref<LibraryMonster | null>(null)
const saving = ref(false)
const saveFailed = ref(false)

function openSheet(mode: MonsterSheetMode, source: LibraryMonster | null = null) {
  sheetMode.value = mode
  sheetSource.value = source
  saveFailed.value = false
  sheetOpen.value = true
}

async function save(draft: MonsterDraft) {
  const id = gameId.value
  if (!id || saving.value) return
  const editing = sheetMode.value === 'edit' ? sheetSource.value : null
  const monster: LibraryMonster = { ...draft, id: editing?.id ?? crypto.randomUUID() }
  saving.value = true
  saveFailed.value = false
  try {
    if (editing) await updateMonster(id, monster)
    else await createMonster(id, monster)
    sheetOpen.value = false
    expandedId.value = monster.id
  } catch (err) {
    // The sheet stays open with what was typed and says so; a lost connection also raises the overlay.
    log.warn('saving a monster failed', { err })
    saveFailed.value = true
  } finally {
    saving.value = false
  }
}

// ── Delete ──
const deleting = ref<LibraryMonster | null>(null)
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (v) => { if (!v) deleting.value = null },
})

async function confirmDelete() {
  const target = deleting.value
  if (!target) return
  const id = gameId.value
  if (!id) return
  const ok = await run('deleteMonster', t('library.monsters.remove.failed'), () => deleteMonster(id, target.id))
  if (ok) deleting.value = null
}

function retry() {
  if (masterOf.value) void loadMonsters(masterOf.value)
}

function backToTable() {
  void router.push(tableRoute())
}
</script>

<template>
  <div class="content-wrap ml-screen">
    <header class="ml-head">
      <div class="ml-titles">
        <h1 class="ml-title">{{ t('library.monsters.title') }}</h1>
        <p v-if="game" class="ml-game">{{ game.name }}</p>
      </div>
      <Button variant="ghost" size="sm" @click="backToTable">{{ t('library.monsters.back') }}</Button>
    </header>

    <div v-if="loading" class="ml-note" role="status">{{ t('library.monsters.loading') }}</div>

    <div v-else-if="!hasList" class="ml-note" role="alert">
      <p>{{ t('library.monsters.loadFailed') }}</p>
      <Button variant="ghost" size="sm" @click="retry">{{ t('library.monsters.retry') }}</Button>
    </div>

    <template v-else>
      <div v-if="failed" class="ml-stale" role="alert">
        <p>{{ t('library.monsters.loadFailed') }}</p>
        <Button variant="ghost" size="sm" @click="retry">{{ t('library.monsters.retry') }}</Button>
      </div>

      <div class="ml-toolbar">
        <label class="ml-search">
          <IconSearch class="ml-search-icon" aria-hidden="true" />
          <input
            v-model="query"
            class="ml-search-input"
            type="search"
            autocomplete="off"
            :aria-label="t('library.monsters.search')"
            :placeholder="t('library.monsters.searchPlaceholder')"
          >
        </label>
        <Button variant="primary" size="sm" :icon-left="IconPlus" @click="openSheet('add')">{{ t('library.monsters.add') }}</Button>
      </div>

      <div v-if="library.monsters.length === 0" class="ml-empty">
        <p class="ml-empty-title">{{ t('library.monsters.empty') }}</p>
        <p class="ml-empty-hint">{{ t('library.monsters.emptyHint') }}</p>
      </div>

      <p v-else-if="shown.length === 0" class="ml-note" role="status">
        {{ t('library.monsters.noMatches', { query: query.trim() }) }}
      </p>

      <ul v-else class="ml-list" :aria-label="t('library.monsters.title')">
        <MonsterRow
          v-for="m in shown"
          :key="m.id"
          :monster="m"
          :expanded="expandedId === m.id"
          @update:expanded="v => expandedId = v ? m.id : null"
          @edit="openSheet('edit', m)"
          @duplicate="openSheet('duplicate', m)"
          @delete="deleting = m"
        />
      </ul>
    </template>

    <MonsterSheet
      v-model:open="sheetOpen"
      :mode="sheetMode"
      :source="sheetSource"
      :saving="saving"
      :failed="saveFailed"
      @save="save"
    />

    <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('library.monsters.remove.title', { name: deleting?.name ?? '' })">
      <p>{{ t('library.monsters.remove.body') }}</p>
      <template #actions>
        <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('library.monsters.remove.confirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </div>
</template>

<style scoped>
.ml-screen {
  /* Same column as the game settings: centred, never under GameLayout's side panels. */
  --ml-w: min(640px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--ml-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--ml-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--ml-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ml-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ml-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ml-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.ml-game {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ml-toolbar { display: flex; align-items: center; gap: 10px; }
.ml-search {
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
.ml-search:focus-within { border-color: var(--vtt-border-gold); }
.ml-search-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--vtt-text-muted); }
.ml-search-input {
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
.ml-search-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }

.ml-stale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--vtt-danger);
  border-radius: var(--r-sm);
  background: var(--vtt-danger-soft);
}
.ml-stale p { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }

.ml-list { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

.ml-note {
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
.ml-note p { margin: 0; }

.ml-empty {
  padding: 24px 18px;
  text-align: center;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-md);
}
.ml-empty-title { margin: 0 0 6px; font-family: var(--font-serif); font-size: 16px; color: var(--vtt-accent-soft); }
.ml-empty-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
</style>
