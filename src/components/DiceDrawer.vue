<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCharactersStore } from '@/stores/characters'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { useUnifiedLog, type LogFilter } from '@/composables/useUnifiedLog'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry, ChangeKind } from '@/types/changeLog'
import { STAT_LABELS } from '@/data/xpTable'
import { t } from '@/locales'
import { formatChangeLabel, formatChangeDelta, isCoinSpend } from '@/utils/changeFormat'
import { createLogger } from '@/utils/logger'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import { useGameLayout } from '@/components/layout/gameLayoutContext'

const filterOptions = computed<Array<{ value: LogFilter; label: string }>>(() => [
  { value: 'rolls', label: t('diceDrawer.filter.rolls') },
  { value: 'changes', label: t('diceDrawer.filter.changes') },
  { value: 'all', label: t('diceDrawer.filter.all') },
])

const log = createLogger('dice-drawer')

const charStore = useCharactersStore()
const { rollFree } = useDiceRoller()
const unified = useUnifiedLog()
const layout = useGameLayout()

const filter = ref<LogFilter>('all')
const notation = ref('2d6')
const notationError = ref('')
const recentId = ref<string | null>(null)

const activeChar = computed(() => charStore.active)

const items = computed(() => unified.filtered(filter.value))

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
  if (!activeChar.value) return
  const norm = normalize(notationStr)
  if (!isValidNotation(notationStr)) {
    notationError.value = t('diceDrawer.input.error')
    return
  }
  notationError.value = ''
  try {
    await rollFree(activeChar.value.id, activeChar.value.name, norm)
  } catch (e) {
    log.error('roll failed', e)
  }
}

async function onSubmit() {
  const n = notation.value.trim()
  if (!n) return
  await doRoll(n)
}

function onInput() { if (notationError.value) notationError.value = '' }

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function authorFor(charId: string, charName?: string): string {
  if (charName) return charName
  const live = charStore.list.find(c => c.id === charId)
  return live?.name ?? '—'
}

function rollMetaLabel(r: RollRecord): string {
  if (r.purpose.kind === 'stat') return STAT_LABELS[r.purpose.statKey] ?? r.purpose.statKey
  if (r.purpose.kind === 'damage') return t('diceDrawer.meta.damage')
  if (r.purpose.kind === 'hit-dice') return t('diceDrawer.rollMeta.hitDice')
  if (r.purpose.kind === 'hp-init') return t('diceDrawer.rollMeta.hpInit')
  return t('diceDrawer.meta.manual')
}

function rollMetaSecondary(r: RollRecord): string | null {
  if (r.purpose.kind === 'damage') return r.purpose.weaponName
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
  <!-- ── СВЁРНУТЫЙ ВИД · rail 56px ───────────────── -->
  <div v-if="layout?.rightCollapsed.value" class="dice-rail">
    <button
      type="button"
      class="btn-rail-toggle"
      :aria-label="t('diceDrawer.title')"
      @click="layout.toggleCollapsed('right')"
    >
      <IconChevronLeft :size="14" />
    </button>
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
      :disabled="!activeChar || isRolling"
      @click="doRoll('2d6')"
    >
      <IconDice :size="18" />
    </button>
  </div>

  <!-- ── РАЗВЁРНУТЫЙ ВИД ─────────────────────────── -->
  <aside v-else class="dice-drawer">
    <div class="drawer-header">
      <button
        v-if="layout"
        type="button"
        class="btn-collapse"
        :title="t('diceDrawer.actions.collapse')"
        :aria-label="t('diceDrawer.actions.collapse')"
        @click="layout.toggleCollapsed('right')"
      >
        <IconChevronRight :size="14" />
      </button>
      <span class="drawer-title">{{ t('diceDrawer.title') }}</span>
      <button
        v-if="unified.hasAny.value"
        type="button"
        class="btn-collapse"
        :title="t('diceDrawer.actions.clear')"
        :aria-label="t('diceDrawer.actions.clear')"
        @click="unified.clearAll()"
      >
        <IconTrash :size="14" />
      </button>
    </div>

    <div class="drawer-filter">
      <SegmentedFilter v-model="filter" :options="filterOptions" variant="pill" full-width />
    </div>

    <div class="drawer-log">
      <div v-if="!items.length" class="drawer-empty">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
          <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z"/>
          <path d="M8 1.5 L8 8 M2 5 L8 8 M14 5 L8 8"/>
        </svg>
        <div class="e-title">{{ t('diceDrawer.empty.title') }}</div>
        <div class="e-hint">{{ t('diceDrawer.empty.hint') }}</div>
      </div>

      <template v-for="item in items" :key="item.id">
        <div
          v-if="item.kind === 'roll'"
          class="dice-row"
          :class="rollClasses(item.payload)"
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
                <span class="dot"></span><span>{{ rollMetaSecondary(item.payload) }}</span>
              </template>
              <span class="dot"></span><span>{{ authorFor(item.payload.characterId, item.payload.characterName) }}</span>
              <span class="dot"></span><span>{{ formatTime(item.payload.timestamp) }}</span>
            </div>
            <div class="dice-row-formula">
              <span class="f-expr">{{ rollExpr(item.payload) }}</span>
              <span v-if="item.payload.dice.length" class="f-rolls">
                ·&nbsp;
                <template v-for="(d, i) in item.payload.dice" :key="i">
                  <em>{{ d.value }}</em><template v-if="i < item.payload.dice.length - 1"> + </template>
                </template>
              </span>
            </div>
          </div>
          <div class="dice-row-result">{{ item.payload.total }}</div>
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
              <span class="dot"></span><span>{{ authorFor(item.payload.characterId, item.payload.characterName) }}</span>
              <span class="dot"></span><span>{{ formatTime(item.payload.timestamp) }}</span>
            </div>
            <div class="log-row-label">{{ logLabel(item.payload) }}</div>
          </div>
          <div v-if="logDelta(item.payload)" class="log-row-delta">{{ logDelta(item.payload) }}</div>
        </div>
      </template>
    </div>

    <div class="drawer-quick">
      <div class="drawer-quick-label">{{ t('diceDrawer.quick') }}</div>
      <div class="quick-rolls">
        <button
          v-for="n in QUICK_ROLLS"
          :key="n"
          type="button"
          class="qr-chip"
          :class="{ 'is-highlight': n === '2d6' }"
          :disabled="isRolling || !activeChar"
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
          :disabled="!activeChar || isRolling"
          @keyup.enter="onSubmit"
          @input="onInput"
        />
        <button
          type="button"
          class="btn-hero"
          :disabled="!activeChar || isRolling || !notation.trim()"
          @click="onSubmit"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z"/>
          </svg>
          {{ t('diceDrawer.input.submit') }}
        </button>
      </div>
      <div v-if="notationError" class="drawer-input-hint is-error">{{ notationError }}</div>
      <div v-else-if="!activeChar" class="drawer-input-hint">{{ t('diceDrawer.input.hint') }}</div>
    </div>
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
.drawer-title {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  margin: 0;
}

.btn-collapse {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(228, 201, 160, 0.04);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: 50%;
  color: var(--vtt-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.btn-collapse:hover {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-border-strong);
  background: rgba(228, 201, 160, 0.08);
}

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
.drawer-log::-webkit-scrollbar { width: 4px; }
.drawer-log::-webkit-scrollbar-thumb {
  background: var(--vtt-border-strong);
  border-radius: var(--r-pill);
}
.drawer-log::-webkit-scrollbar-track { background: transparent; }

.drawer-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  flex: 1;
  min-height: 200px;
  color: var(--vtt-text-muted);
  text-align: center;
  padding: 0 24px;
}
.drawer-empty svg { width: 48px; height: 48px; opacity: 0.4; color: var(--vtt-accent-deep); }
.drawer-empty .e-title {
  font-family: var(--font-serif);
  font-size: 15px; font-style: italic;
  color: var(--vtt-text-secondary);
}
.drawer-empty .e-hint { font-size: 12px; }

/* Dice row */
.dice-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: rgba(36, 28, 21, 0.55);
  border-radius: var(--r-md);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background var(--t-fast) var(--ease);
}
.dice-row:hover { background: rgba(36, 28, 21, 0.72); }
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
  overflow: hidden;
  white-space: nowrap;
}
.dice-row-meta b { color: var(--vtt-accent-deep); font-weight: 500; }
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
.dice-row-formula .f-mod { color: var(--vtt-text-muted); }
.dice-row-result {
  min-width: 40px;
  height: 40px; padding: 0 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(7, 5, 10, 0.45);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  flex-shrink: 0;
}
.dice-row.is-crit {
  background: linear-gradient(to right, rgba(140, 106, 58, 0.22), rgba(36, 28, 21, 0.55) 60%);
  box-shadow: inset 0 0 0 1px rgba(212, 168, 87, 0.25);
}
.dice-row.is-crit .dice-row-result {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 14px rgba(212, 168, 87, 0.35);
}
.dice-row.is-crit .dice-row-glyph { color: var(--vtt-accent); }
.dice-row.is-success {
  outline: 1px solid rgba(212, 168, 87, 0.25);
  outline-offset: -1px;
}
.dice-row.is-success .dice-row-result {
  color: var(--vtt-accent);
}
.dice-row.is-success .dice-row-glyph { color: var(--vtt-accent); opacity: 0.85; }
.dice-row.is-fail { background: rgba(121, 43, 59, 0.18); }
.dice-row.is-fail .dice-row-result {
  color: var(--vtt-danger-bright);
  background: rgba(121, 43, 59, 0.2);
}
.dice-row.is-fail .dice-row-glyph { color: var(--vtt-danger-bright); opacity: 0.75; }
.dice-row.is-damage .dice-row-glyph { color: var(--vtt-danger-bright); }
.dice-row.is-fresh { animation: dice-row-fresh 1600ms var(--ease); }

/* Log row */
.log-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: rgba(36, 28, 21, 0.55);
  border-radius: var(--r-md);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background var(--t-fast) var(--ease);
}
.log-row:hover { background: rgba(36, 28, 21, 0.72); }
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
  overflow: hidden; white-space: nowrap;
}
.log-row-meta b { color: var(--vtt-accent-deep); font-weight: 500; }
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
  height: 40px; padding: 0 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(7, 5, 10, 0.45);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  flex-shrink: 0;
  white-space: nowrap;
}
.log-row.is-hp-damage .log-row-glyph { color: var(--vtt-danger-bright); }
.log-row.is-hp-damage .log-row-delta {
  color: var(--vtt-danger-bright);
  background: rgba(121, 43, 59, 0.2);
}
.log-row.is-hp-heal .log-row-glyph { color: var(--vtt-success); }
.log-row.is-hp-heal .log-row-delta {
  color: var(--vtt-success);
  background: rgba(107, 142, 78, 0.18);
}
.log-row.is-xp .log-row-glyph { color: var(--vtt-accent); }
.log-row.is-xp .log-row-delta { color: var(--vtt-accent); }
.log-row.is-levelup {
  background: linear-gradient(to right, rgba(140, 106, 58, 0.22), rgba(36, 28, 21, 0.55) 60%);
  box-shadow: inset 0 0 0 1px rgba(212, 168, 87, 0.25);
}
.log-row.is-levelup .log-row-glyph { color: var(--vtt-accent); }
.log-row.is-levelup .log-row-delta {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 14px rgba(212, 168, 87, 0.35);
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
.quick-rolls { display: flex; gap: 6px; flex-wrap: wrap; }
.qr-chip {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 4px;
  min-width: 44px;
  height: 30px;
  padding: 0 10px;
  background: rgba(36, 28, 21, 0.55);
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
  background: rgba(140, 106, 58, 0.2);
}
.qr-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.qr-chip.is-highlight {
  color: var(--vtt-accent);
  background: rgba(140, 106, 58, 0.25);
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
  background: rgba(7, 5, 10, 0.55);
  border: 1px solid rgba(140, 106, 58, 0.3);
  border-radius: var(--r-pill);
  color: var(--vtt-text-primary);
  outline: none;
  min-width: 0;
  transition: border-color var(--t-fast) var(--ease);
}
.dice-input input::placeholder { color: var(--vtt-text-muted); }
.dice-input input:focus { border-color: var(--vtt-border-gold); }
.dice-input input:disabled { opacity: 0.55; }

.btn-hero {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 20px;
  background: #A6833E;
  border: 1px solid #8C6A3A;
  border-radius: var(--r-pill);
  color: #1a1205;
  font-family: var(--font-sans);
  font-size: 13px; font-weight: 600;
  letter-spacing: 0.02em; line-height: 1;
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(140, 106, 58, 0.35));
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), filter var(--t-fast) var(--ease);
  white-space: nowrap;
}
.btn-hero:hover:not(:disabled) {
  background: #BF9A4C;
  border-color: #A6833E;
  filter: drop-shadow(0 0 14px rgba(140, 106, 58, 0.5));
}
.btn-hero:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
.btn-hero svg { width: 14px; height: 14px; }

.drawer-input-hint {
  font-family: var(--font-mono); font-size: 10px;
  color: var(--vtt-text-muted);
  margin-top: 6px;
}
.drawer-input-hint.is-error { color: var(--vtt-danger-bright); }

/* ── СВЁРНУТЫЙ ВИД · rail 56px ─────────────────────── */
.dice-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--s-3) 0;
  width: 56px;
  height: 100%;
  gap: var(--s-3);
}

.btn-rail-toggle {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(228, 201, 160, 0.04);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: 50%;
  color: var(--vtt-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.btn-rail-toggle:hover {
  color: var(--vtt-accent);
  border-color: var(--vtt-border-strong);
  background: rgba(228, 201, 160, 0.08);
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
  background: rgba(7, 5, 10, 0.45);
  border-radius: var(--r-sm);
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  opacity: calc(1 - var(--i, 0) * 0.08);
  flex-shrink: 0;
}
.rh-value.is-crit {
  background: var(--vtt-accent);
  color: var(--vtt-bg-base);
  box-shadow: 0 0 8px rgba(212, 168, 87, 0.35);
  text-shadow: none;
}
.rh-value.is-success {
  color: var(--vtt-accent);
  box-shadow: inset 0 0 0 1px rgba(212, 168, 87, 0.45);
}
.rh-value.is-fail {
  background: rgba(121, 43, 59, 0.2);
  color: var(--vtt-danger-bright);
}
.rh-value.is-damage { color: var(--vtt-danger-bright); }

.btn-rail-roll {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(140, 106, 58, 0.55) 0%, rgba(74, 58, 40, 0.75) 100%);
  border: none;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.28);
  color: var(--vtt-accent-soft);
  cursor: pointer;
  flex-shrink: 0;
  transition: filter var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.btn-rail-roll:hover:not(:disabled) {
  filter: drop-shadow(0 0 12px rgba(212, 168, 87, 0.4));
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.45);
  color: var(--vtt-accent);
}
.btn-rail-roll:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
