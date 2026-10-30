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
const hasList = computed(() => forThisGame.value && (library.status.monsters === 'ready' || library.monsters.length > 0))
const failed = computed(() => forThisGame.value && library.status.monsters === 'failed')
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
  <ScreenColumn>
    <ScreenHeader :title="t('library.monsters.title')" :subtitle="game?.name">
      <template #actions>
        <Button variant="ghost" size="sm" @click="backToTable">{{ t('library.monsters.back') }}</Button>
      </template>
    </ScreenHeader>

    <StateNote v-if="loading" role="status">{{ t('library.monsters.loading') }}</StateNote>

    <StateNote v-else-if="!hasList" role="alert">
      {{ t('library.monsters.loadFailed') }}
      <template #action>
        <Button variant="ghost" size="sm" @click="retry">{{ t('library.monsters.retry') }}</Button>
      </template>
    </StateNote>

    <template v-else>
      <AlertBanner v-if="failed">
        {{ t('library.monsters.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retry">{{ t('library.monsters.retry') }}</Button>
        </template>
      </AlertBanner>

      <div class="ml-toolbar">
        <SearchField v-model="query" class="ml-search" :label="t('library.monsters.search')" :placeholder="t('library.monsters.searchPlaceholder')" />
        <Button variant="primary" size="sm" :icon-left="IconPlus" @click="openSheet('add')">{{ t('library.monsters.add') }}</Button>
      </div>

      <EmptyState v-if="library.monsters.length === 0" :title="t('library.monsters.empty')" :hint="t('library.monsters.emptyHint')" />

      <StateNote v-else-if="shown.length === 0" role="status">
        {{ t('library.monsters.noMatches', { query: query.trim() }) }}
      </StateNote>

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
  </ScreenColumn>
</template>

<style scoped>
.ml-toolbar { display: flex; align-items: center; gap: 10px; }
.ml-search { flex: 1; }
.ml-list { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
</style>
