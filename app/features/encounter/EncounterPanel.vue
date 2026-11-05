<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import StateNote from '@/components/ui/StateNote.vue'
import MonsterSheet, { type MonsterDraft } from '@/features/monster-library/MonsterSheet.vue'
import EncounterCard from './EncounterCard.vue'
import EncounterPickSheet from './EncounterPickSheet.vue'
import { useDeferredOrder } from '@/composables/useDeferredOrder'
import { retryEncounter } from '@/composables/useEncounterSession'
import { useMonsterRolls } from '@/composables/useMonsterRolls'
import { useSortableList } from '@/composables/useSortableList'
import { useTableSelection } from '@/composables/useTableSelection'
import {
  applyInstanceEdit,
  changeHp,
  emptyEncounter,
  killMonster,
  monsterLabel,
  moveInOrder,
  orderMonsters,
  reviveMonster,
  switchSortMode,
  toggleCondition,
} from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { useToastsStore } from '@/stores/toasts'
import { removeMonsterInstance, saveEncounterState, saveMonster } from '@/transport/encounter'
import type { ConditionId, EncounterMonster, SortMode } from '@/types/encounter'
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
const currentState = () => store.state ?? emptyEncounter(store.gameId)

const sortModel = computed<SortMode>({
  get: () => sortMode.value,
  set: (mode) => {
    if (mode !== sortMode.value) saveEncounterState(switchSortMode(currentState(), mode, store.monsters))
  },
})
const sortOptions = computed(() => [
  { value: 'auto' as const, label: t('encounter.sort.auto') },
  { value: 'manual' as const, label: t('encounter.sort.manual') },
])

// The list must not move under the pointer: while anything holds it every card keeps its slot, so a card that
// dies or revives under the pointer stays put, rendered as it now is, and the next one never slides under it.
const HOLD_TOUCH_MS = 2000
// A mouse or a pen holds it anywhere in the list, not just on one card: the card above would otherwise slide into
// the slot the pointer is heading for.
const pointerInList = ref(false)
// A touch has no leave, so it holds for a while after each touch.
const touching = ref(false)
let touchTimer: ReturnType<typeof setTimeout> | undefined
// A drag holds for its whole length: the pointer crosses cards and gaps, and a touch has no timer to run out.
const dragging = ref(false)
// The card with keyboard focus: moving its node would drop the focus.
const focusedId = ref<string | null>(null)
const held = computed(() => pointerInList.value || touching.value || dragging.value || focusedId.value !== null)

const target = computed(() => [order.value.alive.map(m => m.id), order.value.dead.map(m => m.id)])
const { shown, showTarget } = useDeferredOrder(target, held)
const monsterIds = computed(() => new Map(store.monsters.map(m => [m.id, m])))
const shownAlive = computed(() => shown.value[0]!.flatMap(id => monsterIds.value.get(id) ?? []))
const shownDead = computed(() => shown.value[1]!.flatMap(id => monsterIds.value.get(id) ?? []))

function holdByTouch() {
  touching.value = true
  clearTimeout(touchTimer)
  touchTimer = setTimeout(() => { touching.value = false }, HOLD_TOUCH_MS)
}
function onListEnter(e: PointerEvent) {
  if (e.pointerType === 'touch') holdByTouch()
  else pointerInList.value = true
}
function onListLeave(e: PointerEvent) {
  if (e.pointerType !== 'touch') pointerInList.value = false
}
function onListDown(e: PointerEvent) {
  if (e.pointerType === 'touch') holdByTouch()
}
onBeforeUnmount(() => clearTimeout(touchTimer))

function cardIdOf(el: EventTarget | null): string | null {
  return el instanceof Element ? el.closest<HTMLElement>('[data-id]')?.dataset.id ?? null : null
}
function onFocusIn(e: FocusEvent) {
  const el = e.target as Element
  focusedId.value = el.matches(':focus-visible') ? cardIdOf(el) : null
}
function onFocusOut(e: FocusEvent) {
  // On to another card, the focusin that follows decides; a window that lost the focus gives it back to this node.
  if (cardIdOf(e.relatedTarget) || e.target === document.activeElement) return
  focusedId.value = null
}
const stackRef = ref<HTMLElement | null>(null)
// The focus can go without a focusout (a removed card, a button turned disabled); the hold must not outlive it.
watch(target, () => {
  if (focusedId.value !== null && !stackRef.value?.contains(document.activeElement)) focusedId.value = null
}, { flush: 'post' })
// Esc on a popup or a sheet gives the focus back to a card wherever the pointer is, and that hold has no end of its
// own: the first pointer move outside the list ends it.
function onPointerMoveOutside(e: PointerEvent) {
  if (!stackRef.value?.contains(e.target as Node)) focusedId.value = null
}
function stopWatchingPointer() {
  document.removeEventListener('pointermove', onPointerMoveOutside)
}
watch(focusedId, (id) => {
  if (id === null) stopWatchingPointer()
  else document.addEventListener('pointermove', onPointerMoveOutside, { passive: true })
})
onBeforeUnmount(stopWatchingPointer)

const listRef = ref<{ $el: HTMLElement } | null>(null)
const listEl = computed(() => listRef.value?.$el ?? null)

// The dropped order is the one on screen, which a hold may have kept from the stored one.
function moveCard(id: string, beforeId: string | null) {
  const state = currentState()
  saveEncounterState({ ...state, manualOrder: moveInOrder(shown.value[0]!, id, beforeId) })
  showTarget()
}
useSortableList(listEl, {
  enabled: computed(() => sortMode.value === 'manual'),
  handle: '.ec-grip',
  onMove: moveCard,
  onStart: () => { dragging.value = true },
  onEnd: () => { dragging.value = false },
})

async function onKeyMove(id: string, direction: -1 | 1) {
  const ids = shown.value[0]!
  const at = ids.indexOf(id)
  if (at === -1 || at + direction < 0 || at + direction >= ids.length) return
  moveCard(id, direction === -1 ? ids[at - 1]! : (ids[at + 2] ?? null))
  await nextTick()
  // Vue moves the node, which drops its focus.
  listEl.value?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"] .ec-grip`)?.focus()
}

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
  if (m.diedAt !== undefined && next.diedAt === undefined) putFirstInManual(id)
}

// A revived monster goes to the top of a manual order, however it was revived.
function putFirstInManual(id: string) {
  if (sortMode.value !== 'manual') return
  const state = currentState()
  saveEncounterState({ ...state, manualOrder: [id, ...state.manualOrder.filter(x => x !== id)] })
}

function onKillOrRevive(id: string) {
  const m = fresh(id)
  if (!m) return
  const dead = m.diedAt !== undefined
  saveMonster(dead ? reviveMonster(m, Date.now()) : killMonster(m, Date.now()))
  if (dead) putFirstInManual(id)
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
// Kept when the sheet closes, or the title loses the name during the closing animation.
const removingLabel = ref('')
const removeBusy = ref(false)

function askRemove(m: EncounterMonster) {
  removingLabel.value = monsterLabel(m)
  removingId.value = m.id
}

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
      <SegmentedFilter v-model="sortModel" :options="sortOptions" variant="pill" :aria-label="t('encounter.sort.label')" />
      <Button variant="dashed" size="sm" :icon-left="IconPlus" @click="pickOpen = true">{{ t('encounter.addMonster') }}</Button>
    </header>

    <div
      ref="stackRef"
      class="ep-stack"
      @pointerenter="onListEnter"
      @pointerleave="onListLeave"
      @pointerdown="onListDown"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <StateNote v-if="store.status === 'loading' && !store.monsters.length" size="sm" role="status">{{ t('encounter.loading') }}</StateNote>
      <StateNote v-else-if="(store.status === 'failed' || store.refreshFailed) && !store.monsters.length" size="sm" role="alert">
        {{ t('encounter.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retryEncounter">{{ t('encounter.retry') }}</Button>
        </template>
      </StateNote>
      <EmptyState v-else-if="!store.monsters.length" :hint="t('encounter.empty')" />

      <template v-else>
        <TransitionGroup ref="listRef" tag="div" name="ep-move" class="ep-alive">
          <EncounterCard
            v-for="m in shownAlive"
            :key="m.id"
            :data-id="m.id"
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
            @move="d => onKeyMove(m.id, d)"
            @edit="editingId = m.id"
            @remove="askRemove(m)"
          />
        </TransitionGroup>
        <SectionLabel v-if="shownDead.length" as="h3" tone="neutral" class="ep-dead">{{ t('encounter.defeated') }}</SectionLabel>
        <div v-if="shownDead.length" class="ep-dead-list">
          <EncounterCard
            v-for="m in shownDead"
            :key="m.id"
            :data-id="m.id"
            :monster="m"
            :selected="store.selectedMonsterId === m.id"
            :expanded="expandedOf(m.id)"
            :sort-mode="sortMode"
            @select="select(m)"
            @update:expanded="v => setExpanded(m.id, v)"
            @attack="onAttack(m.id)"
            @kill-or-revive="onKillOrRevive(m.id)"
            @change-hp="d => onChangeHp(m.id, d)"
            @toggle-condition="c => onToggleCondition(m.id, c)"
            @edit="editingId = m.id"
            @remove="askRemove(m)"
          />
        </div>
      </template>
    </div>

    <!-- Under the list, not over it: a notice arriving on its own must not move the cards under the pointer. -->
    <AlertBanner v-if="store.refreshFailed && store.monsters.length" class="ep-notice">
      {{ t('encounter.loadFailed') }}
      <template #action>
        <Button variant="ghost" size="sm" @click="retryEncounter">{{ t('encounter.retry') }}</Button>
      </template>
    </AlertBanner>

    <EncounterPickSheet v-model:open="pickOpen" :game-id="store.gameId" />
    <MonsterSheet v-model:open="editOpen" mode="edit" :source="editSource" @save="onSave" />

    <ConfirmSheet v-model:open="removeOpen" variant="danger" :title="t('encounter.remove.title', { name: removingLabel })">
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
  flex-wrap: wrap;
  gap: 8px;
  /* Room on the right for the column's close button. */
  padding: 12px 40px 10px 14px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.ep-title {
  margin: 0;
  flex: 1 1 auto;
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
.ep-notice { flex-shrink: 0; margin: 0 10px 10px; }
.ep-alive, .ep-dead-list { display: flex; flex-direction: column; gap: 8px; }
.ep-move-move { transition: transform var(--t-med) var(--ease); }
@media (prefers-reduced-motion: reduce) {
  .ep-move-move { transition: none; }
}
.ep-dead { display: flex; align-items: center; gap: 8px; margin: 6px 2px 0; }
.ep-dead::after { content: ''; flex: 1; height: 1px; background: var(--vtt-border-subtle); }
</style>
