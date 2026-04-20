<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { CLASSES } from '@/data/classes'
import { totalArmor, armorTypeLabel, xpToNextLevel, xpProgressPercent, isReadyToLevelUp, isWeapon, damageFormula } from '@/utils/derived'
import HpBreakdownPopover from '@/components/ui/HpBreakdownPopover.vue'
import ArmorBreakdownPopover from '@/components/ui/ArmorBreakdownPopover.vue'
import DamageBreakdownPopover from '@/components/ui/DamageBreakdownPopover.vue'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()
const emit = defineEmits<{
  levelUp: []
  back: []
}>()

const className = computed(() =>
  props.char.classId === 'custom'
    ? (props.char.customClassName ?? 'Свой класс')
    : CLASSES[props.char.classId].name
)
const armor = computed(() => totalArmor(props.char))
const armorType = computed(() => armorTypeLabel(props.char))
const equippedWeapon = computed(() => {
  const weapons = props.char.inventory.filter(isWeapon)
  return weapons.find(w => w.equipped) ?? weapons[0] ?? null
})
const dmgFormula = computed(() =>
  equippedWeapon.value ? damageFormula(props.char, equippedWeapon.value) : null
)
const xpToNext = computed(() => xpToNextLevel(props.char))
const xpPct = computed(() => xpProgressPercent(props.char))
const ready = computed(() => isReadyToLevelUp(props.char))

function bumpHp(delta: number) {
  if (delta > 0) props.dispatch({ type: 'HEAL', amount: delta })
  else if (delta < 0) props.dispatch({ type: 'APPLY_DAMAGE', amount: Math.abs(delta) })
}
function bumpXp(delta: number) {
  if (delta !== 0) props.dispatch({ type: 'GAIN_XP', amount: delta })
}
</script>

<template>
  <header class="hdr">
    <div class="hdr__top">
      <button class="btn-ghost" @click="emit('back')">← Список</button>
      <div class="hdr__title">
        <div class="hdr__name">{{ char.name }}</div>
        <div class="label">{{ className }} · Уровень {{ char.level }}<span v-if="char.trueName"> · “{{ char.trueName }}”</span></div>
      </div>
      <div v-if="equippedWeapon" class="hdr__stat">
        <div class="label">Урон</div>
        <div class="hdr__stat-row">
          <div class="hdr__stat-val">{{ dmgFormula }}</div>
          <DamageBreakdownPopover :char="char" :weapon="equippedWeapon" />
        </div>
      </div>
      <div class="hdr__stat">
        <div class="label">Броня</div>
        <div class="hdr__stat-row">
          <div class="hdr__stat-val">{{ armor }}</div>
          <ArmorBreakdownPopover :char="char" />
        </div>
        <div v-if="armorType" class="label">{{ armorType }}</div>
      </div>
    </div>

    <div v-if="ready" class="levelup">
      <span>Готов к повышению уровня!</span>
      <button class="btn-primary" @click="emit('levelUp')">Повысить ↑</button>
    </div>

    <div class="hdr__meters">
      <div class="meter">
        <div class="meter__label">HP</div>
        <div class="meter__controls">
          <button class="btn-mini" @click="bumpHp(-1)">−</button>
          <span class="meter__val">{{ char.currentHp }} / {{ char.maxHp }}</span>
          <HpBreakdownPopover :char="char" />
          <button class="btn-mini" @click="bumpHp(1)">+</button>
        </div>
      </div>
      <div class="meter">
        <div class="meter__label">
          XP {{ xpToNext !== null ? `(до ${xpToNext})` : '(макс)' }}
        </div>
        <div class="meter__controls">
          <button class="btn-mini" @click="bumpXp(-10)">−10</button>
          <span class="meter__val">{{ char.xp }}</span>
          <button class="btn-mini" @click="bumpXp(10)">+10</button>
          <button class="btn-mini" @click="bumpXp(100)">+100</button>
        </div>
        <div class="xp-bar"><div class="xp-bar__fill" :style="{ width: xpPct + '%' }" /></div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hdr { border-bottom: 1px solid var(--color-border); padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.hdr__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.hdr__title { flex: 1; }
.hdr__name { font-size: 20px; font-weight: 700; }
.hdr__stat { text-align: right; }
.hdr__stat-row { display: flex; align-items: center; gap: 4px; }
.hdr__stat-val { font-size: 18px; font-weight: 700; }
.levelup { background: var(--color-bg-elevated); border: 1px solid var(--color-accent); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; font-size: 13px; }
.hdr__meters { display: flex; flex-direction: column; gap: 8px; }
.meter { display: flex; flex-direction: column; gap: 4px; }
.meter__label { font-size: 12px; color: var(--color-text-muted); }
.meter__controls { display: flex; align-items: center; gap: 8px; }
.meter__val { flex: 1; text-align: center; font-weight: 600; }
.btn-mini { padding: 2px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; border-radius: 3px; font-family: inherit; }
.xp-bar { height: 3px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.xp-bar__fill { height: 100%; background: var(--color-accent); transition: width 0.3s; }
</style>
