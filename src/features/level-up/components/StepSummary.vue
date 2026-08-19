<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId, SkillId, StatKey } from '@/types/character'
import { STAT_KEYS } from '@/data/xpTable'
import type { LevelUpPatch } from '@/domain/commands'
import { t } from '@/locales'
import { skillName as skillNameOf, abilityName as abilityNameOf, statShort } from '@/locales/content'

const props = defineProps<{ char: Character; pending: Partial<LevelUpPatch>; targetLevel: number }>()

function findNewSkill(): SkillId | null {
  if (!props.pending.skillIds) return null
  const old = new Set(props.char.skillIds)
  return props.pending.skillIds.find(id => !old.has(id)) ?? null
}
function findNewAbility(): AbilityId | null {
  if (!props.pending.abilityIds) return null
  const old = new Set(props.char.abilityIds)
  return props.pending.abilityIds.find(id => !old.has(id)) ?? null
}
function findBumpedStat(): { key: StatKey; from: number; to: number } | null {
  if (!props.pending.stats) return null
  for (const k of STAT_KEYS) {
    const from = props.char.stats[k]
    const to = props.pending.stats[k]
    if (to > from) return { key: k, from, to }
  }
  return null
}

const newSkillId = computed(findNewSkill)
const newAbilityId = computed(findNewAbility)
const bumpedStat = computed(findBumpedStat)

const skillName = computed(() => {
  const id = newSkillId.value
  if (!id) return null
  return skillNameOf(id)
})
const abilityName = computed(() => {
  const id = newAbilityId.value
  if (!id) return null
  return abilityNameOf(id)
})

const magicOpened = computed(() => !props.char.magic && !!props.pending.magic)

const damageDelta = computed(() => {
  const newVal = props.pending.damageBonusDice
  if (newVal === undefined) return 0
  return newVal - props.char.damageBonusDice
})

const maxHpDelta = computed(() => {
  const newVal = props.pending.maxHp
  if (newVal === undefined) return 0
  return newVal - props.char.maxHp
})
const newMaxHp = computed(() => props.pending.maxHp ?? props.char.maxHp)
const newCurrentHp = computed(() => props.pending.currentHp ?? props.char.currentHp)

function formatMod(n: number) {
  return n > 0 ? `+${n}` : String(n)
}
</script>

<template>
  <div class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('levelUp.summary.sectionLabel') }}</span>
      <span class="cc-section-hint">{{ t('levelUp.summary.sectionHint') }}</span>
    </div>
    <div class="lu-summary">
      <div class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L15 5 L15 11 C15 13 12 16 9 16 C6 16 3 13 3 11 L3 5 Z"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.level') }}</span>
          <span class="lu-sum-name">{{ targetLevel }}</span>
        </div>
        <span class="lu-sum-value"><em>{{ t('levelUp.summary.was', { n: char.level }) }}</em></span>
      </div>

      <div v-if="skillName" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><path d="M9 5 L9 9 L12 11"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.skill') }}</span>
          <span class="lu-sum-name">{{ skillName }}</span>
        </div>
      </div>

      <div v-if="abilityName" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L11 7 L16 8 L12 12 L13 17 L9 14 L5 17 L6 12 L2 8 L7 7 Z"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.ability') }}</span>
          <span class="lu-sum-name">{{ abilityName }}</span>
        </div>
      </div>

      <div v-if="bumpedStat" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14 L9 4 L15 14 Z"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.stat') }}</span>
          <span class="lu-sum-name">{{ statShort(bumpedStat.key) }} {{ formatMod(bumpedStat.from) }} → {{ formatMod(bumpedStat.to) }}</span>
        </div>
      </div>

      <div v-if="damageDelta > 0" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9 L9 3 L15 9 L9 15 Z"/><path d="M9 6 L9 12"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.damage') }}</span>
          <span class="lu-sum-name">+{{ damageDelta }}d6 <span class="lu-sum-pill">{{ t('levelUp.summary.pillAuto') }}</span></span>
        </div>
      </div>

      <div v-if="magicOpened" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L11 7 L16 8 L12 12 L13 17 L9 14 L5 17 L6 12 L2 8 L7 7 Z"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.magic') }}</span>
          <span class="lu-sum-name">{{ t('levelUp.summary.magicOpened') }} <span class="lu-sum-pill">{{ t('levelUp.summary.pillOpen') }}</span></span>
        </div>
      </div>

      <div v-if="maxHpDelta > 0" class="lu-sum-row">
        <span class="lu-sum-glyph" aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><path d="M6 9 L9 12 L12 7"/></svg>
        </span>
        <div class="lu-sum-body">
          <span class="lu-sum-label">{{ t('levelUp.summary.hp') }}</span>
          <span class="lu-sum-name">{{ newCurrentHp }} / {{ newMaxHp }}</span>
        </div>
        <span class="lu-sum-value is-hp">+{{ maxHpDelta }} <em>{{ t('levelUp.summary.was', { n: char.maxHp }) }}</em></span>
      </div>
    </div>
  </div>
</template>
