<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import type { Character, StatKey } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { STAT_KEYS, STAT_LABELS, MAX_STAT_BONUS } from '@/data/xpTable'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { effectiveStat, statModifierTotal, statModifierLines } from '@/utils/derived'
import { createLogger } from '@/utils/logger'
import StatChip from '@/components/ui/StatChip.vue'
import Stepper from '@/components/ui/Stepper.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import { t } from '@/locales'

const log = createLogger('stats-panel')

type Dispatcher = (cmd: CharacterCommand) => void
const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const { rollStat } = useDiceRoller()

const STAT_FULL: Record<StatKey, string> = {
  str: t('inGame.stats.full.str'),
  dex: t('inGame.stats.full.dex'),
  con: t('inGame.stats.full.con'),
  int: t('inGame.stats.full.int'),
  wis: t('inGame.stats.full.wis'),
  cha: t('inGame.stats.full.cha'),
}

function stateFor(value: number): 'zero' | 'positive' | 'high' {
  if (value <= 0) return 'zero'
  if (value >= 3) return 'high'
  return 'positive'
}

function fmt(v: number): string {
  return v > 0 ? `+${v}` : String(v)
}

function modStr(v: number): string {
  return v >= 0 ? `+${v}` : String(v)
}

function eff(key: StatKey): number {
  return effectiveStat(props.char, key)
}
function modTotal(key: StatKey): number {
  return statModifierTotal(props.char, key)
}
function modList(key: StatKey) {
  return statModifierLines(props.char, key)
}

const editingKey = ref<StatKey | null>(null)

const editBuf = computed({
  get() {
    const k = editingKey.value
    return k ? props.char.stats[k] : 0
  },
  set(v: number) {
    const k = editingKey.value
    if (!k) return
    setStat(k, v)
  },
})

function setStat(key: StatKey, value: number) {
  const v = Math.max(-3, Math.min(MAX_STAT_BONUS, value))
  props.dispatch({ type: 'UPDATE_STATS', stats: { ...props.char.stats, [key]: v } })
}

async function handleRollStat(key: StatKey) {
  try {
    await rollStat(props.char.id, props.char.name, key, STAT_LABELS[key], eff(key))
  } catch (err) {
    log.error('stat roll failed', err)
  }
}

type AddBuf = { label: string; amount: number }
const addBuf = reactive<Record<StatKey, AddBuf>>({
  str: { label: '', amount: 1 },
  dex: { label: '', amount: 1 },
  con: { label: '', amount: 1 },
  int: { label: '', amount: 1 },
  wis: { label: '', amount: 1 },
  cha: { label: '', amount: 1 },
})

function resetAdd(key: StatKey) {
  addBuf[key].label = ''
  addBuf[key].amount = 1
}

function submitAdd(key: StatKey) {
  const buf = addBuf[key]
  const label = buf.label.trim()
  if (!label || buf.amount === 0) return
  props.dispatch({
    type: 'ADD_STAT_MODIFIER',
    statKey: key,
    amount: buf.amount,
    label,
  })
  resetAdd(key)
}

function removeMod(id: string) {
  props.dispatch({ type: 'REMOVE_STAT_MODIFIER', modifierId: id })
}

function clearAll(key: StatKey) {
  props.dispatch({ type: 'CLEAR_STAT_MODIFIERS', statKey: key })
}

function onPopoverOpen(key: StatKey, open: boolean) {
  if (!open) {
    if (editingKey.value === key) editingKey.value = null
    resetAdd(key)
  }
}

function startEdit(key: StatKey) {
  editingKey.value = key
}
function stopEdit() {
  editingKey.value = null
}
</script>

<template>
  <section class="stats-section">
    <div class="stats-grid">
      <StatChip
        v-for="key in STAT_KEYS"
        :key="key"
        :label="STAT_LABELS[key]"
        :value="fmt(eff(key))"
        :state="stateFor(eff(key))"
        :mod="modTotal(key) || undefined"
        :base="modTotal(key) !== 0 ? fmt(char.stats[key]) : undefined"
        dice="2d6"
        has-popover
        @open="onPopoverOpen(key, $event)"
      >
        <template #popover>
          <div class="pop-head">
            <span class="pop-title">{{ STAT_FULL[key] }} · {{ fmt(eff(key)) }}</span>
            <span class="pop-sub">{{ STAT_LABELS[key] }}</span>
          </div>

          <button
            type="button"
            class="pop-hero"
            :disabled="isRolling"
            @click="handleRollStat(key)"
          >
            <IconDice />
            <span>{{ t('inGame.stats.rollBtn', { mod: modStr(eff(key)) }) }}</span>
          </button>

          <div class="pop-divider" />

          <div class="pop-section-head">
            <span class="pop-sub">{{ t('inGame.stats.modifiers.title') }}</span>
            <button
              v-if="modList(key).length > 0"
              type="button"
              class="pop-link"
              @click="clearAll(key)"
            >
              {{ t('inGame.stats.modifiers.clearAll') }}
            </button>
          </div>

          <div v-if="modList(key).length === 0" class="pop-empty">
            {{ t('inGame.stats.modifiers.empty') }}
          </div>
          <div v-else class="pop-effects">
            <div
              v-for="m in modList(key)"
              :key="m.id"
              class="pop-effect"
            >
              <span :class="['pop-effect-delta', m.amount > 0 ? 'is-buff' : 'is-debuff']">
                {{ modStr(m.amount) }}
              </span>
              <span class="pop-effect-name">{{ m.label }}</span>
              <button
                type="button"
                class="pop-effect-remove"
                :aria-label="t('inGame.stats.modifiers.removeAria', { label: m.label })"
                @click="removeMod(m.id)"
              >
                ×
              </button>
            </div>
          </div>

          <form
            class="pop-add"
            @submit.prevent="submitAdd(key)"
          >
            <input
              v-model="addBuf[key].label"
              type="text"
              maxlength="32"
              :placeholder="t('inGame.stats.modifiers.addPlaceholder')"
            />
            <Stepper
              v-model="addBuf[key].amount"
              :min="-5"
              :max="5"
              size="sm"
              :aria-label="t('inGame.stats.modifiers.addBtn')"
            />
            <button
              type="submit"
              class="pop-btn pop-btn-add"
              :disabled="!addBuf[key].label.trim() || addBuf[key].amount === 0"
            >
              +
            </button>
          </form>

          <div class="pop-divider" />

          <div v-if="editingKey === key" class="pop-edit">
            <span class="pop-sub">{{ t('inGame.stats.popSub') }}</span>
            <Stepper
              v-model="editBuf"
              :min="-3"
              :max="MAX_STAT_BONUS"
              :aria-label="`Правка ${STAT_LABELS[key]}`"
            />
            <button type="button" class="pop-btn pop-btn-done" @click="stopEdit">
              {{ t('common.save') }}
            </button>
          </div>
          <div v-else class="pop-actions">
            <button type="button" class="pop-btn" @click="startEdit(key)">
              {{ t('inGame.stats.editBase') }}
            </button>
          </div>
        </template>
      </StatChip>
    </div>
  </section>
</template>

<style scoped>
.stats-section {
  padding: 6px 16px 14px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-2);
}
.stats-grid :deep(.stat-chip) { width: 100%; }
</style>

<style>
.stat-popover .pop-hero {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.stat-popover .pop-hero :deep(svg) { width: 14px; height: 14px; }
.stat-popover .pop-hero:disabled { opacity: 0.6; cursor: not-allowed; }

.stat-popover .pop-edit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
}
.stat-popover .pop-edit .pop-sub { flex-shrink: 0; }
.stat-popover .pop-btn-done { flex: 0 0 auto; }

.stat-popover .pop-link {
  background: transparent;
  border: 0;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  cursor: pointer;
}
.stat-popover .pop-link:hover { color: var(--vtt-danger-bright); }

.stat-popover .pop-effects {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.stat-popover .pop-add {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.stat-popover .pop-add input[type="text"] {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
  box-shadow: var(--shadow-inset);
}
.stat-popover .pop-add input[type="text"]::placeholder {
  color: var(--vtt-text-muted);
  opacity: 0.7;
}
.stat-popover .pop-add input[type="text"]:focus {
  border-color: var(--vtt-accent-deep);
}
.stat-popover .pop-btn-add {
  flex: 0 0 auto;
  width: 28px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1;
}
.stat-popover .pop-btn-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
