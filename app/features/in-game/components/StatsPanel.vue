<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import InfoPopoverClose from '@/components/ui/InfoPopoverClose.vue'
import type { Character, StatKey } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { STAT_KEYS, MAX_STAT_BONUS } from '@/data/xpTable'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { useSheetReadonly } from '@/composables/useSheetReadonly'
import { effectiveStat, statModifierTotal, statModifierLines } from '@/utils/derived'
import { createLogger } from '@/utils/logger'
import Button from '@/components/ui/Button.vue'
import StatChip from '@/components/ui/StatChip.vue'
import StateNote from '@/components/ui/StateNote.vue'
import Stepper from '@/components/ui/Stepper.vue'
import TextField from '@/components/ui/TextField.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { t } from '@/locales'
import { statLabel, statShort } from '@/locales/content'

const log = createLogger('stats-panel')

type Dispatcher = (cmd: CharacterCommand) => void
const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const { rollStat } = useDiceRoller()
const readonly = useSheetReadonly()

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
    await rollStat(props.char.id, props.char.name, key, statShort(key), eff(key))
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
        :label="statShort(key)"
        :value="fmt(eff(key))"
        :state="stateFor(eff(key))"
        :mod="modTotal(key) || undefined"
        :base="modTotal(key) !== 0 ? fmt(char.stats[key]) : undefined"
        dice="2d6"
        has-popover
        :popover-title="`${statLabel(key)} · ${fmt(eff(key))}`"
        @open="onPopoverOpen(key, $event)"
      >
        <template #popover>
          <div class="pop-head">
            <span class="pop-title">{{ statLabel(key) }} · {{ fmt(eff(key)) }}</span>
            <span class="pop-sub">{{ statShort(key) }}</span>
          </div>

          <template v-if="!readonly">
            <InfoPopoverClose as-child>
              <Button
                variant="hero"
                class="pop-hero"
                :icon-left="IconDice"
                :disabled="isRolling"
                @click="handleRollStat(key)"
              >{{ t('inGame.stats.rollBtn', { mod: modStr(eff(key)) }) }}</Button>
            </InfoPopoverClose>

            <div class="pop-divider" />
          </template>

          <div class="pop-section-head">
            <span class="pop-sub">{{ t('inGame.stats.modifiers.title') }}</span>
            <button
              v-if="!readonly && modList(key).length > 0"
              type="button"
              class="pop-link"
              @click="clearAll(key)"
            >
              {{ t('inGame.stats.modifiers.clearAll') }}
            </button>
          </div>

          <StateNote v-if="modList(key).length === 0" inline align="start" size="xs">
            {{ t('inGame.stats.modifiers.empty') }}
          </StateNote>
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
              <IconButton
                v-if="!readonly"
                size="sm"
                variant="square"
                tone="danger"
                :label="t('inGame.stats.modifiers.removeAria', { label: m.label })"
                @click="removeMod(m.id)"
              >
                <IconClose :size="10" />
              </IconButton>
            </div>
          </div>

          <template v-if="!readonly">
            <form
              class="pop-add"
              @submit.prevent="submitAdd(key)"
            >
              <TextField
                v-model="addBuf[key].label"
                class="pop-add-label"
                size="sm"
                hide-label
                :maxlength="32"
                :label="t('inGame.stats.modifiers.addPlaceholder')"
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
                :aria-label="t('inGame.stats.editAria', { stat: statShort(key) })"
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
.info-popover .pop-edit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
}
.info-popover .pop-edit .pop-sub { flex-shrink: 0; }
.info-popover .pop-btn-done { flex: 0 0 auto; }

.info-popover .pop-link {
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
.info-popover .pop-link:hover { color: var(--vtt-danger-bright); }

.info-popover .pop-effects {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.info-popover .pop-add {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.info-popover .pop-add-label { flex: 1; }
.info-popover .pop-btn-add {
  flex: 0 0 auto;
  width: 28px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1;
}
.info-popover .pop-btn-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
