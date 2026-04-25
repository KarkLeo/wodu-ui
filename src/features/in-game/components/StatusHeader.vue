<script setup lang="ts">
import { computed } from 'vue'
import { PopoverClose } from 'reka-ui'
import { useRouter } from 'vue-router'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useDiceRoller, isRolling } from '@/composables/useDiceRoller'
import { CLASSES } from '@/data/classes'
import { XP_THRESHOLDS } from '@/data/xpTable'
import {
  totalArmor,
  damageFormulaCompact,
  damageFormulaParts,
  damageAbilityBonus,
  damageBreakdownLines,
  armorBreakdownLines,
  isWeapon,
  isReadyToLevelUp,
} from '@/utils/derived'
import { createLogger } from '@/utils/logger'
import HpBar from '@/components/ui/HpBar.vue'
import XpBar from '@/components/ui/XpBar.vue'
import StatusChipTrio from '@/components/ui/StatusChipTrio.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import Stepper from '@/components/ui/Stepper.vue'
import IconDice from '@/components/ui/icons/IconDice.vue'
import IconWeapon from '@/components/ui/icons/IconWeapon.vue'
import IconShield from '@/components/ui/icons/IconShield.vue'
import IconCoin from '@/components/ui/icons/IconCoin.vue'
import { t } from '@/locales'

const log = createLogger('status-header')

const props = withDefaults(
  defineProps<{ compact?: boolean; id?: string }>(),
  { compact: false },
)

const router = useRouter()
const { id: charId, char, dispatch } = useActiveCharacter(() => props.id)
const { rollDamage } = useDiceRoller()

const className = computed(() => {
  const c = char.value
  if (!c) return ''
  return c.classId === 'custom'
    ? (c.customClassName ?? 'Свой класс')
    : CLASSES[c.classId].name
})

const equippedWeapon = computed(() => {
  const c = char.value
  if (!c) return null
  const weapons = c.inventory.filter(isWeapon)
  return weapons.find(w => w.equipped) ?? weapons[0] ?? null
})

const dmgFormulaStr = computed(() =>
  equippedWeapon.value && char.value ? damageFormulaCompact(char.value, equippedWeapon.value) : '—',
)
const dmgParts = computed(() =>
  char.value && equippedWeapon.value ? damageFormulaParts(char.value, equippedWeapon.value) : null,
)
const armorValue = computed(() => (char.value ? totalArmor(char.value) : 0))
const armorTone = computed<'buff' | 'debuff' | 'neutral'>(() => {
  const m = char.value?.armorMod ?? 0
  return m > 0 ? 'buff' : m < 0 ? 'debuff' : 'neutral'
})
const armorBreakdown = computed(() =>
  char.value ? armorBreakdownLines(char.value) : { lines: [], note: undefined },
)
const damageBreakdown = computed(() =>
  char.value && equippedWeapon.value
    ? damageBreakdownLines(char.value, equippedWeapon.value)
    : [],
)

const damageModModel = computed<number>({
  get: () => char.value?.damageMod ?? 0,
  set: v => {
    const n = Math.trunc(Number(v) || 0)
    if (char.value && n !== (char.value.damageMod ?? 0)) {
      dispatch({ type: 'SET_DAMAGE_MOD', amount: n })
    }
  },
})
const armorModModel = computed<number>({
  get: () => char.value?.armorMod ?? 0,
  set: v => {
    const n = Math.trunc(Number(v) || 0)
    if (char.value && n !== (char.value.armorMod ?? 0)) {
      dispatch({ type: 'SET_ARMOR_MOD', amount: n })
    }
  },
})

const ready = computed(() => (char.value ? isReadyToLevelUp(char.value) : false))
const xpMax = computed(() => {
  const c = char.value
  if (!c) return 0
  if (c.level >= 10) return c.xp
  return XP_THRESHOLDS[c.level + 1] ?? c.xp
})
const xpHint = computed(() => {
  const c = char.value
  if (!c) return ''
  if (c.level >= 10) return t('inGame.statusHeader.xp.hintCap')
  if (ready.value) return t('inGame.statusHeader.xp.hintReady')
  return t('inGame.statusHeader.xp.hintToNext', { level: c.level + 1 })
})

function onApplyDamage(n: number) {
  if (n > 0) dispatch({ type: 'APPLY_DAMAGE', amount: n })
}
function onHeal(n: number) {
  if (n > 0) dispatch({ type: 'HEAL', amount: n })
}
function onSetTempHp(n: number) {
  dispatch({ type: 'SET_TEMP_HP', amount: n })
}
function onXpUpdate(v: number) {
  if (!char.value) return
  const delta = v - char.value.xp
  if (delta !== 0) dispatch({ type: 'GAIN_XP', amount: delta })
}
function onLevelUp() {
  router.push(`/character/${charId.value}/levelup`)
}

const coinsModel = computed<number>({
  get: () => char.value?.coins ?? 0,
  set: v => {
    const value = Math.max(0, Math.floor(Number(v) || 0))
    if (char.value && value !== char.value.coins) {
      dispatch({ type: 'SET_COINS', amount: value })
    }
  },
})

async function handleRollDamage() {
  const c = char.value
  const w = equippedWeapon.value
  if (!c || !w || !w.damage) return
  try {
    const flat = damageAbilityBonus(c, w) + (c.damageMod ?? 0)
    await rollDamage(c.id, c.name, w.name, w.damage, c.damageBonusDice, flat)
  } catch (err) {
    log.error('damage roll failed', err)
  }
}
</script>

<template>
  <div v-if="char" :class="['status-header', { 'is-compact': compact }]">
    <div class="sh-id">
      <div class="sh-id-text">
        <div class="sh-id-line">
          <span class="sh-name">{{ char.name }}</span>
          <span class="sh-meta"><b>{{ className }}</b> · {{ t('inGame.statusHeader.levelLabel') }} {{ char.level }}</span>
        </div>
        <span v-if="char.trueName && !compact" class="sh-truename">
          <span class="sh-truename-glyph" aria-hidden="true">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
              <path d="M6 1.5 C3 1.5 1 4 1 6 C1 8 3 10.5 6 10.5 C9 10.5 11 8 11 6 C11 4 9 1.5 6 1.5 Z" />
              <circle cx="6" cy="6" r="1.6" fill="currentColor" />
            </svg>
          </span>
          {{ char.trueName }}
        </span>
      </div>
    </div>

    <div class="sh-trio">
      <StatusChipTrio no-frame>
        <StatusChip
          v-if="equippedWeapon"
          kind="damage"
          :label="t('inGame.statusHeader.trio.damage')"
          :value="dmgFormulaStr"
          :size="compact ? 'sm' : 'base'"
          has-popover
        >
          <template #symbol><IconWeapon /></template>
          <template #value>
            <template v-if="dmgParts">
              <span class="sh-val-base">{{ dmgParts.base }}</span><span
                v-if="dmgParts.tail"
                :class="['sh-val-tail', `is-${dmgParts.tailTone}`]"
              >{{ dmgParts.tail }}</span>
            </template>
            <template v-else>{{ dmgFormulaStr }}</template>
          </template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">{{ equippedWeapon.name }}</span>
              <span class="pop-sub">{{ dmgFormulaStr }}</span>
            </div>
            <div class="breakdown">
              <div
                v-for="(line, idx) in damageBreakdown"
                :key="idx"
                class="breakdown-row"
              >
                <span class="br-name">{{ line.label }}</span>
                <span class="br-value">{{ line.value }}</span>
              </div>
            </div>
            <div class="sh-pop-mod">
              <span class="sh-pop-mod-label">{{ t('inGame.statusHeader.modSection') }}</span>
              <Stepper
                v-model="damageModModel"
                :min="-10"
                :max="10"
                size="sm"
                :aria-label="t('inGame.statusHeader.damage.modAria')"
              />
              <button
                v-if="damageModModel !== 0"
                type="button"
                class="sh-pop-mod-reset"
                @click="damageModModel = 0"
              >{{ t('inGame.statusHeader.modReset') }}</button>
            </div>
            <PopoverClose as-child>
              <button
                type="button"
                class="pop-hero-roll"
                :disabled="isRolling"
                @click="handleRollDamage"
              >
                <IconDice />
                <span>{{ t('inGame.statusHeader.trio.damageRoll', { formula: dmgFormulaStr }) }}</span>
              </button>
            </PopoverClose>
          </template>
        </StatusChip>
        <StatusChip
          v-else
          kind="dim"
          :label="t('inGame.statusHeader.trio.damage')"
          value="—"
          :size="compact ? 'sm' : 'base'"
          has-popover
        >
          <template #symbol><IconWeapon /></template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">{{ t('inGame.statusHeader.trio.damage') }}</span>
              <span class="pop-sub">—</span>
            </div>
            <div class="sh-pop-empty">{{ t('inGame.statusHeader.trio.damageEmpty') }}</div>
          </template>
        </StatusChip>
        <StatusChip
          kind="armor"
          :label="t('inGame.statusHeader.trio.armor')"
          :value="armorValue"
          :size="compact ? 'sm' : 'base'"
          has-popover
        >
          <template #symbol><IconShield /></template>
          <template #value>
            <span :class="['sh-val-armor', `is-${armorTone}`]">{{ armorValue }}</span>
          </template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">{{ t('inGame.statusHeader.trio.armor') }}</span>
              <span class="pop-sub">{{ armorValue }}</span>
            </div>
            <div v-if="armorBreakdown.lines.length" class="breakdown">
              <div
                v-for="(line, idx) in armorBreakdown.lines"
                :key="idx"
                class="breakdown-row"
              >
                <span class="br-name">{{ line.label }}</span>
                <span class="br-value">{{ line.value }}</span>
              </div>
            </div>
            <div v-else class="sh-pop-empty">{{ t('inGame.statusHeader.trio.armorEmpty') }}</div>
            <div v-if="armorBreakdown.note" class="sh-pop-note">{{ armorBreakdown.note }}</div>
            <div class="sh-pop-mod">
              <span class="sh-pop-mod-label">{{ t('inGame.statusHeader.modSection') }}</span>
              <Stepper
                v-model="armorModModel"
                :min="-10"
                :max="10"
                size="sm"
                :aria-label="t('inGame.statusHeader.armor.modAria')"
              />
              <button
                v-if="armorModModel !== 0"
                type="button"
                class="sh-pop-mod-reset"
                @click="armorModModel = 0"
              >{{ t('inGame.statusHeader.modReset') }}</button>
            </div>
          </template>
        </StatusChip>
        <StatusChip
          kind="coin"
          :label="t('inGame.statusHeader.trio.coins')"
          :value="char.coins"
          :size="compact ? 'sm' : 'base'"
          has-popover
        >
          <template #symbol><IconCoin /></template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">{{ t('inGame.statusHeader.trio.coins') }}</span>
              <span class="pop-sub">{{ char.coins }}</span>
            </div>
            <div class="sh-pop-coin-edit">
              <Stepper
                v-model="coinsModel"
                :min="0"
                :aria-label="t('inGame.statusHeader.trio.coins')"
              />
            </div>
          </template>
        </StatusChip>
      </StatusChipTrio>
    </div>

    <div class="sh-hp">
      <HpBar
        :current="char.currentHp"
        :max="char.maxHp"
        :temp="char.tempHp ?? 0"
        :size="compact ? 'sm' : 'base'"
        :show-controls="!compact"
        @apply-damage="onApplyDamage"
        @heal="onHeal"
        @add-temp="onSetTempHp"
      />
    </div>

    <div v-if="!compact" class="sh-xp">
      <XpBar
        :current="char.xp"
        :max="xpMax"
        :hint="xpHint"
        :is-ready="ready"
        :is-cap="char.level >= 10"
        @update:current="onXpUpdate"
        @level-up="onLevelUp"
      />
    </div>
  </div>
</template>

<style scoped>
.status-header {
  padding: 10px 16px 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "id"
    "trio"
    "hp"
    "xp";
  row-gap: 8px;
}

.sh-id { grid-area: id; min-width: 0; padding-right: 36px; }
.sh-id-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sh-id-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  flex-wrap: nowrap;
}

.sh-name {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 20px;
  color: var(--vtt-accent-soft);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.sh-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  line-height: 1;
  flex-shrink: 0;
  white-space: nowrap;
}
.sh-meta b { color: var(--vtt-text-secondary); font-weight: 600; }

.sh-truename {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sh-truename-glyph { width: 10px; height: 10px; color: var(--vtt-accent-deep); }
.sh-truename-glyph svg { width: 100%; height: 100%; display: block; }

.sh-trio { grid-area: trio; justify-self: start; }
.sh-hp { grid-area: hp; }
.sh-xp { grid-area: xp; }

.status-header.is-compact {
  padding: 8px 16px;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "id trio"
    "hp hp";
  row-gap: 6px;
  column-gap: 12px;
  align-items: center;
}
.status-header.is-compact .sh-trio { justify-self: end; }
.status-header.is-compact .sh-name { font-size: 16px; }
.status-header.is-compact .sh-meta { font-size: 9px; }
</style>

<style>
.sc-popover .sh-pop-empty {
  font-size: 13px;
  color: var(--vtt-text-muted);
  padding: 8px 0;
}
.sc-popover .sh-pop-note {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--vtt-border-subtle);
  font-size: 12px;
  color: var(--vtt-text-muted);
  line-height: 1.45;
  font-style: italic;
}
.sc-popover .pop-hero-roll svg { width: 14px; height: 14px; }
.sc-popover .pop-hero-roll:disabled { opacity: 0.6; cursor: not-allowed; }

.sc-popover .sh-pop-coin-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0 2px;
}
.sc-popover .sh-pop-coin-edit .sc-stepper input {
  width: 140px;
}

.sc-popover .sh-pop-mod {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.sc-popover .sh-pop-mod-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  flex: 1;
}
.sc-popover .sh-pop-mod-reset {
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
.sc-popover .sh-pop-mod-reset:hover { color: var(--vtt-danger-bright); }

.status-chip .sh-val-tail.is-buff,
.status-chip .sh-val-armor.is-buff {
  color: var(--vtt-success);
}
.status-chip .sh-val-tail.is-debuff,
.status-chip .sh-val-armor.is-debuff {
  color: var(--vtt-danger-bright);
}
</style>
