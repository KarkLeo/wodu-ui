<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCharactersStore } from '@/stores/characters'
import { useEncounterStore } from '@/stores/encounter'
import { useApplyHit } from '@/composables/useApplyHit'
import { useMonsterRolls } from '@/composables/useMonsterRolls'
import { useTableSelection } from '@/composables/useTableSelection'
import { monsterLabel } from '@/domain/encounter'
import ApplyHitPopover from '@/features/encounter/ApplyHitPopover.vue'
import HitRow from '@/features/encounter/HitRow.vue'
import NumberedName from '@/features/encounter/NumberedName.vue'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { useUnifiedLog, type LogFilter } from '@/composables/useUnifiedLog'
import type { RollMode, RollRecord } from '@/types/dice'
import type { ChangeEntry, ChangeKind } from '@/types/changeLog'
import { t, currentLocale } from '@/locales'
import { statShort, gearName } from '@/locales/content'
import { formatChangeLabel, formatChangeDelta, isCoinSpend } from '@/utils/changeFormat'
import { createLogger } from '@/utils/logger'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import IconDiceOutline from '@/components/ui/icons/IconDiceOutline.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormError from '@/components/ui/FormError.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { useGameLayout } from '@/components/layout/gameLayoutContext'

const log = createLogger('dice-drawer')

const charStore = useCharactersStore()
const encounter = useEncounterStore()
const { rollFree } = useDiceRoller()
const { rollFreeAs } = useMonsterRolls()
const unified = useUnifiedLog()
const applyHit = useApplyHit()
const { selection } = useTableSelection()
const layout = useGameLayout()

const filterOptions = computed<Array<{ value: LogFilter; label: string }>>(() => [
  { value: 'rolls', label: t('diceDrawer.filter.rolls') },
  { value: 'changes', label: t('diceDrawer.filter.changes') },
  { value: 'all', label: t('diceDrawer.filter.all') },
  ...(applyHit.enabled.value ? [{ value: 'hits' as const, label: t('encounter.log.hits') }] : []),
])

const filter = ref<LogFilter>('all')
watch(() => applyHit.enabled.value, (on) => {
  if (!on && filter.value === 'hits') filter.value = 'all'
})
const notation = ref('2d6')
const notationError = ref('')
const recentId = ref<string | null>(null)
const pendingMode = ref<RollMode>('normal')

function toggleMode(mode: Exclude<RollMode, 'normal'>) {
  pendingMode.value = pendingMode.value === mode ? 'normal' : mode
}

// Rolls go to the active character, only one at the open table, and only one the user can edit (not a
// teammate's read-only sheet).
const scopedActive = computed(() => {
  const c = charStore.active
  return c && charStore.inScope(c.id) ? c : undefined
})
const activeChar = computed(() => {
  const c = scopedActive.value
  return c && charStore.canEditCharacter(c.id) ? c : undefined
})
const readOnlyActive = computed(() => (activeChar.value ? undefined : scopedActive.value))

const items = computed(() => unified.filtered(filter.value))
const listed = computed(() => (filter.value === 'hits' ? applyHit.hits.value.length : items.value.length))

// A selected monster rolls in place of the active character; only the master has one.
const rollingMonster = computed(() => {
  const sel = selection.value
  if (!applyHit.enabled.value || sel?.kind !== 'monster') return undefined
  return encounter.monsterById(sel.id)
})
const canRoll = computed(() => !!rollingMonster.value || !!activeChar.value)

const applicableIds = computed(() => new Set(
  items.value.filter(i => i.kind === 'roll' && applyHit.applicable(i.payload)).map(i => i.id),
))
const hitLines = computed(() => new Map(
  items.value.filter(i => i.kind === 'roll').map(i => [i.id, applyHit.hitsOf(i.id)]),
))

const logEl = ref<HTMLElement | null>(null)
const popup = ref<{ roll: RollRecord; el: HTMLElement } | null>(null)
const popupOpen = computed({
  get: () => popup.value !== null,
  set: (open) => { if (!open) popup.value = null },
})

function openApply(roll: RollRecord, el: HTMLElement) {
  popup.value = popup.value?.roll.id === roll.id ? null : { roll, el }
}

function onRowKeydown(e: KeyboardEvent, roll: RollRecord) {
  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault()
  openApply(roll, e.currentTarget as HTMLElement)
}

function onApply(amount: number) {
  const open = popup.value
  if (open) void applyHit.apply(open.roll, amount)
}

// The popup belongs to one roll and one target: when the target goes or changes, or the roll can no longer go there, it closes.
watch(() => {
  const tg = applyHit.target.value
  return tg ? `${tg.kind}:${tg.id}` : null
}, () => { popup.value = null })
watch(() => !!popup.value && !applyHit.applicable(popup.value.roll), (gone) => {
  if (gone) popup.value = null
})

const railHistory = computed<RollRecord[]>(() =>
  unified.filtered('rolls')
    .slice(0, 10)
    .map(i => i.payload as RollRecord),
)

watch(() => unified.items.value[0]?.id, (id) => {
  if (!id) return
  recentId.value = id
  window.setTimeout(() => { if (recentId.value === id) recentId.value = null }, 1600)
})

const QUICK_ROLLS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', '2d6', '3d6', 'd100']

function normalize(n: string) { return n.replace(/\s/g, '').replace(/^d/i, '1d') }
function isValidNotation(n: string): boolean {
  return /^\d+d\d+([+\-]\d+d\d+|[+\-]\d+)*$/i.test(normalize(n))
}

async function doRoll(notationStr: string) {
  if (!canRoll.value) return
  const norm = normalize(notationStr)
  if (!isValidNotation(notationStr)) {
    notationError.value = t('diceDrawer.input.error')
    return
  }
  notationError.value = ''
  const mode = pendingMode.value
  try {
    const monster = rollingMonster.value
    if (monster) rollFreeAs(monster, norm, mode)
    else if (activeChar.value) await rollFree(activeChar.value.id, activeChar.value.name, norm, mode)
  } catch (e) {
    log.error('roll failed', e)
  } finally {
    pendingMode.value = 'normal'
  }
}

async function onSubmit() {
  const n = notation.value.trim()
  if (!n) return
  await doRoll(n)
}

function onInput() { if (notationError.value) notationError.value = '' }

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(currentLocale.value, { hour: '2-digit', minute: '2-digit' })
}

function authorFor(charId: string, charName?: string): string {
  if (charName) return charName
  const live = charStore.list.find(c => c.id === charId)
  return live?.name ?? '—'
}

function rollMetaLabel(r: RollRecord): string {
  if (r.purpose.kind === 'stat') return statShort(r.purpose.statKey)
  if (r.purpose.kind === 'damage') return t('diceDrawer.meta.damage')
  if (r.purpose.kind === 'hit-dice') return t('diceDrawer.rollMeta.hitDice')
  if (r.purpose.kind === 'hp-init') return t('diceDrawer.rollMeta.hpInit')
  if (r.rollMode === 'advantage') return t('diceDrawer.mode.advantage')
  if (r.rollMode === 'disadvantage') return t('diceDrawer.mode.disadvantage')
  return t('diceDrawer.meta.manual')
}

function rollMetaSecondary(r: RollRecord): string | null {
  if (r.purpose.kind === 'damage' && r.purpose.weaponName) return gearName(r.purpose.weaponTemplateId, r.purpose.weaponName)
  return null
}

function rollClasses(r: RollRecord) {
  const isStat = r.purpose.kind === 'stat'
  const isD20 = r.notation.toLowerCase() === 'd20' || r.notation.toLowerCase() === '1d20'
  const crit =
    (isStat && r.total >= 12) ||
    (isD20 && r.diceTotal === 20)
  const success = isStat && !crit && r.total >= 10 && r.total <= 11
  const fail = isStat && !crit && r.total <= 6
  return {
    'is-crit': crit,
    'is-success': success,
    'is-fail': fail,
    'is-damage': r.purpose.kind === 'damage',
    'is-advantage': r.rollMode === 'advantage',
    'is-disadvantage': r.rollMode === 'disadvantage',
    'is-fresh': r.id === recentId.value,
  }
}

function rollExpr(r: RollRecord): string {
  const mod = r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : String(r.modifier)) : ''
  return `${r.notation}${mod}`
}

const LOG_CLASS_MAP: Record<ChangeKind, string> = {
  'hp-damage': 'is-hp-damage',
  'hp-heal': 'is-hp-heal',
  'hp-temp': 'is-hp-heal',
  'armor-mod': 'is-attr',
  'damage-mod': 'is-attr',
  'xp-gain': 'is-xp',
  'level-up': 'is-levelup',
  stats: 'is-attr',
  'inventory-add': 'is-inventory-add',
  'inventory-remove': 'is-inventory-remove',
  'inventory-use': 'is-inventory-remove',
  'inventory-edit': 'is-inventory-add',
  equip: 'is-equip',
  unequip: 'is-unequip',
  coins: 'is-coin-earn',
  magic: 'is-magic',
  'modifier-add': 'is-attr',
  'modifier-remove': 'is-attr',
  'modifier-clear': 'is-attr',
  'quicksilver-reset': 'is-magic',
  create: '',
}

function logClass(e: ChangeEntry): string {
  const base = LOG_CLASS_MAP[e.payload.kind] ?? ''
  if (isCoinSpend(e.payload)) return 'is-coin-spend'
  return base + (e.id === recentId.value ? ' is-fresh' : '')
}

function logMeta(e: ChangeEntry): string {
  switch (e.payload.kind) {
    case 'hp-damage':
    case 'hp-heal':
    case 'hp-temp': return t('diceDrawer.meta.hp')
    case 'xp-gain': return t('diceDrawer.meta.xp')
    case 'level-up': return t('diceDrawer.meta.level')
    case 'stats':
    case 'modifier-add':
    case 'modifier-remove':
    case 'modifier-clear':
    case 'armor-mod':
    case 'damage-mod': return t('diceDrawer.meta.attr')
    case 'inventory-add':
    case 'inventory-remove':
    case 'inventory-use':
    case 'inventory-edit': return t('diceDrawer.meta.inventory')
    case 'equip':
    case 'unequip': return t('diceDrawer.meta.equip')
    case 'coins': return t('diceDrawer.meta.coin')
    case 'magic':
    case 'quicksilver-reset': return t('diceDrawer.meta.magic')
    default: return ''
  }
}

function logLabel(e: ChangeEntry): string {
  return formatChangeLabel(e.payload)
}

function logDelta(e: ChangeEntry): string | undefined {
  return formatChangeDelta(e.payload)
}
</script>

<template>
  <!-- ── COLLAPSED VIEW · rail 56px ───────────────── -->
  <div v-if="layout?.rightCollapsed.value" class="dice-rail">
    <IconButton size="lg" :label="t('diceDrawer.title')" @click="layout.toggleCollapsed('right')">
      <IconChevronLeft :size="14" />
    </IconButton>
    <span class="gl-rail-label">{{ t('diceDrawer.title') }}</span>
    <div v-if="railHistory.length" class="dice-rail-history">
      <span
        v-for="(r, i) in railHistory"
        :key="r.id"
        :class="['rh-value', rollClasses(r)]"
        :style="{ '--i': i }"
      >{{ r.total }}</span>
    </div>
    <button
      type="button"
      class="btn-rail-roll"
      :aria-label="t('diceDrawer.rail.rollFree')"
      :disabled="!canRoll || isRolling"
      @click="doRoll('2d6')"
    >
      <IconDice :size="18" />
    </button>
  </div>

  <!-- ── EXPANDED VIEW ─────────────────────────── -->
  <aside v-else class="dice-drawer">
    <div class="drawer-header">
      <IconButton
        v-if="layout"
        class="drawer-collapse"
        :title="t('diceDrawer.actions.collapse')"
        :label="t('diceDrawer.actions.collapse')"
        @click="layout.toggleCollapsed('right')"
      >
        <IconChevronRight :size="14" />
      </IconButton>
      <SectionLabel size="md" class="drawer-title">{{ t('diceDrawer.title') }}</SectionLabel>
      <IconButton
        class="drawer-clear"
        :title="t('diceDrawer.actions.clear')"
        :label="t('diceDrawer.actions.clear')"
        :disabled="!unified.hasAny.value"
        @click="unified.clearAll()"
      >
        <IconTrash :size="14" />
      </IconButton>
    </div>

    <div class="drawer-filter">
      <SegmentedFilter v-model="filter" :options="filterOptions" variant="pill" full-width />
    </div>

    <div ref="logEl" class="drawer-log" tabindex="-1">
      <div v-if="!listed" class="drawer-empty">
        <EmptyState
          variant="plain"
          :title="filter === 'hits' ? t('encounter.log.hitsEmpty') : t('diceDrawer.empty.title')"
          :hint="filter === 'hits' ? undefined : t('diceDrawer.empty.hint')"
        >
          <template #icon><IconDice /></template>
        </EmptyState>
      </div>

      <template v-if="filter === 'hits'">
        <HitRow v-for="hit in applyHit.hits.value" :key="hit.id" :hit="hit" />
      </template>

      <template v-else>
        <template v-for="item in items" :key="item.id">
          <div
            v-if="item.kind === 'roll'"
            class="dice-row"
            :class="[rollClasses(item.payload), { 'is-applicable': applicableIds.has(item.id) }]"
            :data-roll="item.id"
            :role="applicableIds.has(item.id) ? 'button' : undefined"
            :tabindex="applicableIds.has(item.id) ? 0 : undefined"
            :aria-haspopup="applicableIds.has(item.id) ? 'dialog' : undefined"
            :aria-expanded="applicableIds.has(item.id) ? popup?.roll.id === item.id : undefined"
            @click="applicableIds.has(item.id) && openApply(item.payload, $event.currentTarget as HTMLElement)"
            @keydown="applicableIds.has(item.id) && onRowKeydown($event, item.payload)"
          >
            <span class="dice-row-glyph" aria-hidden="true">
              <svg v-if="item.payload.purpose.kind === 'damage'" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5 C8 1.5 3 6.5 3 10 C3 12.761 5.239 15 8 15 C10.761 15 13 12.761 13 10 C13 6.5 8 1.5 8 1.5 Z"/>
              </svg>
              <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z"/>
                <path d="M8 1.5 L8 8 M2 5 L8 8 M14 5 L8 8"/>
              </svg>
            </span>
            <div class="dice-row-body">
              <div class="dice-row-meta">
                <b>{{ rollMetaLabel(item.payload) }}</b>
                <template v-if="rollMetaSecondary(item.payload)">
                  <span class="dot"></span><span class="dice-row-meta-secondary">{{ rollMetaSecondary(item.payload) }}</span>
                </template>
                <span class="dot"></span><NumberedName class="dice-row-meta-author" :label="authorFor(item.payload.characterId, item.payload.characterName)" />
                <span class="dot"></span><span class="dice-row-meta-time">{{ formatTime(item.payload.timestamp) }}</span>
              </div>
              <div class="dice-row-formula">
                <span class="f-expr">{{ rollExpr(item.payload) }}</span>
                <span v-if="item.payload.dice.length" class="f-rolls">
                  ·&nbsp;
                  <template v-for="(d, i) in item.payload.dice" :key="i">
                    <em>{{ d.value }}</em><template v-if="i < item.payload.dice.length - 1"> + </template>
                  </template>
                </span>
                <span v-if="item.payload.discardedTotal !== undefined" class="f-alt">
                  · {{ t('diceDrawer.mode.alt') }} {{ item.payload.discardedTotal }}
                </span>
              </div>
            </div>
            <div class="dice-row-result">{{ item.payload.total }}</div>
            <div v-if="applicableIds.has(item.id) && applyHit.target.value" class="dice-row-go">→ <NumberedName :label="applyHit.target.value.name" /></div>
            <div v-if="hitLines.get(item.id)?.length" class="dice-row-hits">
              <span v-for="hit in hitLines.get(item.id)" :key="hit.id" class="dice-row-hit">→ <NumberedName :label="hit.target.name" /> <em>−{{ hit.amount }}</em></span>
            </div>
          </div>

          <div v-else class="log-row" :class="logClass(item.payload)">
            <span class="log-row-glyph" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 5 v6 M6 7 h4" stroke-linecap="round"/>
              </svg>
            </span>
            <div class="log-row-body">
              <div class="log-row-meta">
                <b>{{ logMeta(item.payload) }}</b>
                <span class="dot"></span><span class="log-row-meta-author">{{ authorFor(item.payload.characterId, item.payload.characterName) }}</span>
                <span class="dot"></span><span class="log-row-meta-time">{{ formatTime(item.payload.timestamp) }}</span>
              </div>
              <div class="log-row-label">{{ logLabel(item.payload) }}</div>
            </div>
            <div v-if="logDelta(item.payload)" class="log-row-delta"><span class="log-row-delta-text">{{ logDelta(item.payload) }}</span></div>
          </div>
        </template>
      </template>
    </div>

    <div class="drawer-quick">
      <div class="drawer-quick-label">{{ t('diceDrawer.mode.label') }}</div>
      <div class="drawer-mode">
        <button
          type="button"
          class="mode-chip"
          :class="{ 'is-armed': pendingMode === 'advantage' }"
          :disabled="isRolling || !canRoll"
          :aria-pressed="pendingMode === 'advantage'"
          @click="toggleMode('advantage')"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M8 13 L8 3 M4 7 L8 3 L12 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('diceDrawer.mode.advantage') }}
        </button>
        <button
          type="button"
          class="mode-chip"
          :class="{ 'is-armed': pendingMode === 'disadvantage' }"
          :disabled="isRolling || !canRoll"
          :aria-pressed="pendingMode === 'disadvantage'"
          @click="toggleMode('disadvantage')"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M8 3 L8 13 M4 9 L8 13 L12 9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t('diceDrawer.mode.disadvantage') }}
        </button>
      </div>
      <div class="drawer-quick-label">{{ t('diceDrawer.quick') }}</div>
      <div class="quick-rolls">
        <button
          v-for="n in QUICK_ROLLS"
          :key="n"
          type="button"
          class="qr-chip"
          :class="{ 'is-highlight': n === '2d6' }"
          :disabled="isRolling || !canRoll"
          @click="doRoll(n)"
        >{{ n }}</button>
      </div>
    </div>

    <div class="drawer-input-bar">
      <div class="dice-input">
        <input
          type="text"
          v-model="notation"
          :placeholder="t('diceDrawer.input.placeholder')"
          :disabled="!canRoll || isRolling"
          @keyup.enter="onSubmit"
          @input="onInput"
        />
        <Button
          variant="hero"
          :icon-left="IconDiceOutline"
          :disabled="!canRoll || isRolling || !notation.trim()"
          @click="onSubmit"
        >{{ t('diceDrawer.input.submit') }}</Button>
      </div>
      <div v-if="notationError || rollingMonster || readOnlyActive || !activeChar" class="drawer-input-note">
        <FormError v-if="notationError">{{ notationError }}</FormError>
        <StateNote v-else-if="rollingMonster" inline align="start" size="xs">{{ t('encounter.log.rollingAs', { name: monsterLabel(rollingMonster) }) }}</StateNote>
        <StateNote v-else-if="readOnlyActive" inline align="start" size="xs">{{ t('diceDrawer.input.readOnly', { name: readOnlyActive.name }) }}</StateNote>
        <StateNote v-else inline align="start" size="xs">{{ t('diceDrawer.input.hint') }}</StateNote>
      </div>
    </div>

    <ApplyHitPopover
      v-if="popup && applyHit.target.value"
      v-model:open="popupOpen"
      :roll="popup.roll"
      :target="applyHit.target.value"
      :anchor="popup.el"
      :fallback="logEl"
      @apply="onApply"
    />
  </aside>
</template>

<style scoped>
.dice-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--s-3) var(--s-4) var(--s-2);
}
.drawer-title { flex: 1; }


.drawer-filter {
  padding: 0 var(--s-4) var(--s-3);
}

.drawer-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--s-3) var(--s-3);
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
}
.drawer-log:focus { outline: none; }
.drawer-log::-webkit-scrollbar { width: 4px; }
.drawer-log::-webkit-scrollbar-thumb {
  background: var(--vtt-border-strong);
  border-radius: var(--r-pill);
}
.drawer-log::-webkit-scrollbar-track { background: transparent; }

.drawer-empty { flex: 1; min-height: 200px; display: flex; align-items: center; }

/* Dice row */
.dice-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: var(--vtt-elevated-a55);
  border-radius: var(--r-md);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  transition: background var(--t-fast) var(--ease);
}
.dice-row:hover { background: var(--vtt-elevated-a72); }
.dice-row-glyph {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--vtt-text-muted);
  flex-shrink: 0;
}
.dice-row-glyph svg { width: 16px; height: 16px; }
.dice-row-body { min-width: 0; }
.dice-row-meta {
  display: flex; gap: 8px; align-items: center;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--vtt-text-muted);
  margin-bottom: 2px;
  min-width: 0;
  white-space: nowrap;
}
.dice-row-meta b { color: var(--vtt-accent-deep); font-weight: 500; flex-shrink: 0; }
.dice-row-meta-secondary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}
.dice-row-meta-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}
.dice-row-meta-time { flex-shrink: 0; white-space: nowrap; }
.dice-row-meta .dot {
  width: 3px; height: 3px; border-radius: var(--r-pill);
  background: var(--vtt-text-muted); opacity: 0.6;
  flex-shrink: 0;
}
.dice-row-formula {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dice-row-formula .f-expr { color: var(--vtt-text-primary); font-weight: 500; }
.dice-row-formula .f-rolls { color: var(--vtt-text-muted); font-style: italic; margin: 0 4px; }
.dice-row-formula .f-rolls em { color: var(--vtt-text-secondary); font-style: normal; }
.dice-row-formula .f-alt {
  color: var(--vtt-text-muted);
  font-style: italic;
  margin-left: 4px;
  font-size: 12px;
}
.dice-row-result {
  min-width: 40px;
  height: 40px; padding: 0 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--vtt-sunken-a45);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  flex-shrink: 0;
}
.dice-row.is-crit {
  background: linear-gradient(to right, var(--vtt-gold-a20), var(--vtt-elevated-a55) 60%);
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a25);
}
.dice-row.is-crit .dice-row-result {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 14px var(--vtt-accent-a35);
}
.dice-row.is-crit .dice-row-glyph { color: var(--vtt-accent); }
.dice-row.is-success {
  outline: 1px solid var(--vtt-accent-a25);
  outline-offset: -1px;
}
.dice-row.is-success .dice-row-result {
  color: var(--vtt-accent);
}
.dice-row.is-success .dice-row-glyph { color: var(--vtt-accent); opacity: 0.85; }
.dice-row.is-fail { background: var(--vtt-danger-a18); }
.dice-row.is-fail .dice-row-result {
  color: var(--vtt-danger-bright);
  background: var(--vtt-danger-a18);
}
.dice-row.is-fail .dice-row-glyph { color: var(--vtt-danger-bright); opacity: 0.75; }
.dice-row.is-damage .dice-row-glyph { color: var(--vtt-danger-bright); }
.dice-row.is-advantage .dice-row-glyph { color: var(--vtt-accent); }
.dice-row.is-advantage .dice-row-meta b { color: var(--vtt-accent); }
.dice-row.is-disadvantage .dice-row-glyph { color: var(--vtt-warning, var(--vtt-danger-bright)); }
.dice-row.is-disadvantage .dice-row-meta b { color: var(--vtt-warning, var(--vtt-danger-bright)); }
.dice-row.is-fresh { animation: dice-row-fresh 1600ms var(--ease); }
.dice-row.is-applicable {
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a45);
}
.dice-row.is-applicable:hover { background: var(--vtt-accent-a18); }
.dice-row.is-applicable:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 2px; }
.dice-row-go {
  grid-column: 1 / -1;
  display: flex;
  gap: 6px;
  min-width: 0;
  margin-top: 6px;
  font-size: 12px;
  color: var(--vtt-accent);
}
.dice-row-hits {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px dashed var(--vtt-border-strong);
}
.dice-row-hit {
  display: flex;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--vtt-text-secondary);
}
.dice-row-hit em {
  flex-shrink: 0;
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-danger-bright);
}

/* Log row */
.log-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: var(--vtt-elevated-a55);
  border-radius: var(--r-md);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  transition: background var(--t-fast) var(--ease);
}
.log-row:hover { background: var(--vtt-elevated-a72); }
.log-row-glyph {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--vtt-text-muted);
  flex-shrink: 0;
}
.log-row-glyph svg { width: 16px; height: 16px; }
.log-row-body { min-width: 0; }
.log-row-meta {
  display: flex; gap: 8px; align-items: center;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--vtt-text-muted);
  margin-bottom: 2px;
  min-width: 0;
  white-space: nowrap;
}
.log-row-meta b { color: var(--vtt-accent-deep); font-weight: 500; flex-shrink: 0; }
.log-row-meta-author {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex-shrink: 1;
}
.log-row-meta-time { flex-shrink: 0; white-space: nowrap; }
.log-row-meta .dot {
  width: 3px; height: 3px; border-radius: var(--r-pill);
  background: var(--vtt-text-muted); opacity: 0.6;
  flex-shrink: 0;
}
.log-row-label {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.log-row-label em { color: var(--vtt-accent-soft); font-style: normal; font-weight: 500; }
.log-row-delta {
  min-width: 48px;
  max-width: 120px;
  height: 40px; padding: 0 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--vtt-sunken-a45);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  flex-shrink: 0;
}
.log-row-delta-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.log-row.is-hp-damage .log-row-glyph { color: var(--vtt-danger-bright); }
.log-row.is-hp-damage .log-row-delta {
  color: var(--vtt-danger-bright);
  background: var(--vtt-danger-a18);
}
.log-row.is-hp-heal .log-row-glyph { color: var(--vtt-success); }
.log-row.is-hp-heal .log-row-delta {
  color: var(--vtt-success);
  background: var(--vtt-success-glow-a15);
}
.log-row.is-xp .log-row-glyph { color: var(--vtt-accent); }
.log-row.is-xp .log-row-delta { color: var(--vtt-accent); }
.log-row.is-levelup {
  background: linear-gradient(to right, var(--vtt-gold-a20), var(--vtt-elevated-a55) 60%);
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a25);
}
.log-row.is-levelup .log-row-glyph { color: var(--vtt-accent); }
.log-row.is-levelup .log-row-delta {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 14px var(--vtt-accent-a35);
  font-size: 22px;
}
.log-row.is-attr .log-row-glyph { color: var(--vtt-accent-deep); }
.log-row.is-attr .log-row-delta { color: var(--vtt-accent); }
.log-row.is-coin-earn .log-row-glyph { color: var(--vtt-success); }
.log-row.is-coin-earn .log-row-delta { color: var(--vtt-success); }
.log-row.is-coin-spend .log-row-glyph { color: var(--vtt-warning); }
.log-row.is-coin-spend .log-row-delta { color: var(--vtt-warning); }
.log-row.is-inventory-add .log-row-glyph { color: var(--vtt-accent-deep); }
.log-row.is-inventory-remove .log-row-glyph { color: var(--vtt-text-muted); opacity: 0.7; }
.log-row.is-inventory-remove .log-row-label {
  color: var(--vtt-text-muted);
  text-decoration: line-through;
  text-decoration-color: var(--vtt-border-strong);
}
.log-row.is-inventory-remove .log-row-delta { color: var(--vtt-text-muted); }
.log-row.is-equip .log-row-glyph { color: var(--vtt-accent-deep); }
.log-row.is-unequip .log-row-glyph { color: var(--vtt-text-muted); opacity: 0.7; }
.log-row.is-unequip .log-row-label { color: var(--vtt-text-secondary); }
.log-row.is-magic .log-row-glyph { color: var(--vtt-info); }
.log-row.is-fresh { animation: dice-row-fresh 1600ms var(--ease); }

/* Quick rolls */
.drawer-quick {
  padding: var(--s-2) var(--s-3);
}
.drawer-quick-label {
  font-family: var(--font-mono); font-size: 9px;
  letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--vtt-text-muted);
  margin: 0 0 8px;
}
.drawer-quick-label + .drawer-quick-label,
.drawer-mode + .drawer-quick-label {
  margin-top: 10px;
}
.drawer-mode {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.mode-chip {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  flex: 1;
  height: 32px;
  padding: 0 10px;
  background: var(--vtt-elevated-a55);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.mode-chip svg { width: 12px; height: 12px; flex-shrink: 0; }
.mode-chip:hover:not(:disabled) {
  color: var(--vtt-accent);
  background: var(--vtt-gold-a15);
}
.mode-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.mode-chip.is-armed {
  color: var(--vtt-accent);
  background: var(--vtt-gold-a25);
  border-color: var(--vtt-accent-a45);
  box-shadow: 0 0 10px var(--vtt-accent-a18);
}
.quick-rolls { display: flex; gap: 6px; flex-wrap: wrap; }
.qr-chip {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 4px;
  min-width: 44px;
  height: 30px;
  padding: 0 10px;
  background: var(--vtt-elevated-a55);
  border: none;
  border-radius: var(--r-sm);
  color: var(--vtt-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.qr-chip:hover:not(:disabled) {
  color: var(--vtt-accent);
  background: var(--vtt-gold-a20);
}
.qr-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.qr-chip.is-highlight {
  color: var(--vtt-accent);
  background: var(--vtt-gold-a25);
}

/* Input bar */
.drawer-input-bar {
  padding: var(--s-3);
}
.dice-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: stretch;
}
.dice-input input {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 10px 16px;
  background: var(--vtt-sunken-a55);
  border: 1px solid var(--vtt-gold-a30);
  border-radius: var(--r-pill);
  color: var(--vtt-text-primary);
  outline: none;
  min-width: 0;
  transition: border-color var(--t-fast) var(--ease);
}
.dice-input input::placeholder { color: var(--vtt-text-muted); }
.dice-input input:focus { border-color: var(--vtt-border-gold); }
.dice-input input:disabled { opacity: 0.55; }

.drawer-input-note { margin-top: 6px; }

/* ── COLLAPSED VIEW · rail 56px ─────────────────────── */
.dice-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--s-3) 0;
  width: 56px;
  height: 100%;
  gap: var(--s-3);
}


.gl-rail-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  margin: var(--s-3) 0;
  white-space: nowrap;
}

.dice-rail-history {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  margin-top: auto;
  flex: 0 1 auto;
  overflow: hidden;
}
.rh-value {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--vtt-sunken-a45);
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  text-shadow: 0 1px 2px var(--vtt-black-a55);
  opacity: calc(1 - var(--i, 0) * 0.08);
  flex-shrink: 0;
}
.rh-value.is-crit {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 8px var(--vtt-accent-a35);
  text-shadow: none;
}
.rh-value.is-success {
  color: var(--vtt-accent);
  box-shadow: inset 0 0 0 1px var(--vtt-accent-a45);
}
.rh-value.is-fail {
  background: var(--vtt-danger-a18);
  color: var(--vtt-danger-bright);
}
.rh-value.is-damage { color: var(--vtt-danger-bright); }

.btn-rail-roll {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--vtt-gold-a55) 0%, var(--vtt-border-strong-a75) 100%);
  border: none;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--vtt-accent-soft-a28);
  color: var(--vtt-accent-soft);
  cursor: pointer;
  flex-shrink: 0;
  transition: filter var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.btn-rail-roll:hover:not(:disabled) {
  filter: drop-shadow(0 0 12px var(--vtt-accent-a40));
  box-shadow: inset 0 0 0 1px var(--vtt-accent-soft-a45);
  color: var(--vtt-accent);
}
.btn-rail-roll:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 960px) {
  .drawer-collapse { display: none; }
  .drawer-header {
    padding-top: 8px;
    padding-right: 52px;
  }
  .drawer-clear { order: -1; }
}
</style>
