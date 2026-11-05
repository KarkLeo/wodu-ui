<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import StateNote from '@/components/ui/StateNote.vue'
import MonsterSheet, { type MonsterDraft } from '@/features/monster-library/MonsterSheet.vue'
import EncounterCard from './EncounterCard.vue'
import EncounterPickSheet from './EncounterPickSheet.vue'
import { useMonsterRolls } from '@/composables/useMonsterRolls'
import { useTableSelection } from '@/composables/useTableSelection'
import {
  applyInstanceEdit,
  changeHp,
  emptyEncounter,
  killMonster,
  monsterLabel,
  orderMonsters,
  reviveMonster,
  toggleCondition,
} from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { useToastsStore } from '@/stores/toasts'
import { removeMonsterInstance, saveMonster } from '@/transport/encounter'
import type { ConditionId, EncounterMonster } from '@/types/encounter'
import type { LibraryMonster } from '@/types/library'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('encounter-panel')
const store = useEncounterStore()
const toasts = useToastsStore()
const { rollAttack } = useMonsterRolls()
const { selectMonster } = useTableSelection()

const order = computed(() => orderMonsters(store.monsters, store.state ?? emptyEncounter(store.gameId)))
const sortMode = computed(() => store.state?.sortMode ?? 'auto')

function expandedOf(id: string) {
  return store.expanded.has(id)
}
function setExpanded(id: string, open: boolean) {
  if (open) store.expanded.add(id)
  else store.expanded.delete(id)
}

function select(m: EncounterMonster) {
  if (m.diedAt !== undefined) return
  selectMonster(m.id)
}

// Always from the store's copy, so a second click builds on the first one's result.
function fresh(id: string): EncounterMonster | undefined {
  return store.monsterById(id)
}

function onChangeHp(id: string, delta: number) {
  const m = fresh(id)
  if (!m) return
  const next = changeHp(m, delta, Date.now())
  if (next.hp === m.hp) return
  saveMonster(next)
  if (next.diedAt !== undefined && store.selectedMonsterId === id) store.selectMonster(null)
}

function onKillOrRevive(id: string) {
  const m = fresh(id)
  if (!m) return
  const dead = m.diedAt !== undefined
  saveMonster(dead ? reviveMonster(m, Date.now()) : killMonster(m, Date.now()))
  if (!dead && store.selectedMonsterId === id) store.selectMonster(null)
}

function onAttack(id: string) {
  const m = fresh(id)
  if (!m || m.diedAt !== undefined) return
  rollAttack(m)
}

function onToggleCondition(id: string, condition: ConditionId) {
  const m = fresh(id)
  if (m) saveMonster(toggleCondition(m, condition, Date.now()))
}

const pickOpen = ref(false)

const editingId = ref<string | null>(null)
const editOpen = computed({
  get: () => editingId.value !== null,
  set: (v: boolean) => { if (!v) editingId.value = null },
})
const editSource = computed<LibraryMonster | null>(() => {
  const m = editingId.value ? fresh(editingId.value) : undefined
  if (!m) return null
  return {
    id: m.id,
    name: m.name,
    hp: m.maxHp,
    armor: m.armor,
    damage: m.damage,
    ...(m.special !== undefined ? { special: m.special } : {}),
    ...(m.notes !== undefined ? { notes: m.notes } : {}),
  }
})

function onSave(draft: MonsterDraft) {
  const m = editingId.value ? fresh(editingId.value) : undefined
  editingId.value = null
  if (m) saveMonster(applyInstanceEdit(m, draft, Date.now()))
}

const removingId = ref<string | null>(null)
const removeOpen = computed({
  get: () => removingId.value !== null,
  set: (v: boolean) => { if (!v) removingId.value = null },
})
const removing = computed(() => (removingId.value ? fresh(removingId.value) : undefined))
const removeBusy = ref(false)

async function confirmRemove() {
  const id = removingId.value
  if (!id || removeBusy.value) return
  removeBusy.value = true
  try {
    await removeMonsterInstance(id)
  } catch (err) {
    log.error('remove failed', { id, err })
    toasts.push(t('errors.encounterRemoveFailed'), 'error')
  } finally {
    removeBusy.value = false
    removingId.value = null
  }
}
</script>

<template>
  <section class="ep" :aria-label="t('encounter.title')">
    <header class="ep-head">
      <h2 class="ep-title">{{ t('encounter.title') }}</h2>
      <Button variant="dashed" size="sm" :icon-left="IconPlus" @click="pickOpen = true">{{ t('encounter.addMonster') }}</Button>
    </header>

    <div class="ep-stack">
      <StateNote v-if="store.status === 'loading' && !store.monsters.length" size="sm">{{ t('encounter.loading') }}</StateNote>
      <StateNote v-else-if="store.status === 'failed' && !store.monsters.length" size="sm">{{ t('encounter.loadFailed') }}</StateNote>
      <EmptyState v-else-if="!store.monsters.length" :hint="t('encounter.empty')" />

      <template v-else>
        <EncounterCard
          v-for="m in order.alive"
          :key="m.id"
          :monster="m"
          :selected="store.selectedMonsterId === m.id"
          :expanded="expandedOf(m.id)"
          :sort-mode="sortMode"
          @update:expanded="v => setExpanded(m.id, v)"
          @select="select(m)"
          @attack="onAttack(m.id)"
          @kill-or-revive="onKillOrRevive(m.id)"
          @change-hp="d => onChangeHp(m.id, d)"
          @toggle-condition="c => onToggleCondition(m.id, c)"
          @edit="editingId = m.id"
          @remove="removingId = m.id"
        />
        <SectionLabel v-if="order.dead.length" as="h3" tone="neutral" class="ep-dead">{{ t('encounter.defeated') }}</SectionLabel>
        <EncounterCard
          v-for="m in order.dead"
          :key="m.id"
          :monster="m"
          :selected="false"
          :expanded="expandedOf(m.id)"
          :sort-mode="sortMode"
          @update:expanded="v => setExpanded(m.id, v)"
          @attack="onAttack(m.id)"
          @kill-or-revive="onKillOrRevive(m.id)"
          @change-hp="d => onChangeHp(m.id, d)"
          @toggle-condition="c => onToggleCondition(m.id, c)"
          @edit="editingId = m.id"
          @remove="removingId = m.id"
        />
      </template>
    </div>

    <EncounterPickSheet v-model:open="pickOpen" :game-id="store.gameId" />
    <MonsterSheet v-model:open="editOpen" mode="edit" :source="editSource" @save="onSave" />

    <ConfirmSheet v-model:open="removeOpen" variant="danger" :title="t('encounter.remove.title', { name: removing ? monsterLabel(removing) : '' })">
      <p>{{ t('encounter.remove.body') }}</p>
      <template #actions>
        <Button variant="hero-danger" :disabled="removeBusy" @click="confirmRemove">{{ t('encounter.remove.confirm') }}</Button>
        <Button variant="ghost" @click="removeOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </section>
</template>

<style scoped>
.ep {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-radius: var(--r-lg);
  background: var(--vtt-surface-a88);
  box-shadow: 0 0 0 1px var(--vtt-gold-a35);
  overflow: hidden;
}
.ep-head {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Room on the right for the column's close button. */
  padding: 12px 40px 10px 14px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.ep-title {
  margin: 0;
  flex: 1;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 20px;
  color: var(--vtt-text-primary);
}
.ep-stack {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ep-dead { display: flex; align-items: center; gap: 8px; margin: 6px 2px 0; }
.ep-dead::after { content: ''; flex: 1; height: 1px; background: var(--vtt-border-subtle); }
</style>
