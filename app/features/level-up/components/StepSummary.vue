<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId, SkillId, StatKey } from '@/types/character'
import { STAT_KEYS } from '@/data/xpTable'
import type { LevelUpPatch } from '@/domain/commands'
import WizardSection from '@/components/layout/WizardSection.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import KeyValueRow from '@/components/ui/KeyValueRow.vue'
import IconCheckCircle from '@/components/ui/icons/IconCheckCircle.vue'
import IconClock from '@/components/ui/icons/IconClock.vue'
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
  <WizardSection>
    <SectionHeader :title="t('levelUp.summary.sectionLabel')" :hint="t('levelUp.summary.sectionHint')" />
    <div class="lu-summary">
      <KeyValueRow class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.level')">
        {{ targetLevel }}
        <template #icon><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L15 5 L15 11 C15 13 12 16 9 16 C6 16 3 13 3 11 L3 5 Z"/></svg></template>
        <template #action><span class="lu-sum-value"><em>{{ t('levelUp.summary.was', { n: char.level }) }}</em></span></template>
      </KeyValueRow>

      <KeyValueRow v-if="skillName" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.skill')">
        {{ skillName }}
        <template #icon><IconClock :size="18" :stroke-width="1.4" /></template>
      </KeyValueRow>

      <KeyValueRow v-if="abilityName" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.ability')">
        {{ abilityName }}
        <template #icon><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L11 7 L16 8 L12 12 L13 17 L9 14 L5 17 L6 12 L2 8 L7 7 Z"/></svg></template>
      </KeyValueRow>

      <KeyValueRow v-if="bumpedStat" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.stat')">
        {{ statShort(bumpedStat.key) }} {{ formatMod(bumpedStat.from) }} → {{ formatMod(bumpedStat.to) }}
        <template #icon><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14 L9 4 L15 14 Z"/></svg></template>
      </KeyValueRow>

      <KeyValueRow v-if="damageDelta > 0" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.damage')">
        +{{ damageDelta }}d6 <span class="lu-sum-pill">{{ t('levelUp.summary.pillAuto') }}</span>
        <template #icon><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9 L9 3 L15 9 L9 15 Z"/><path d="M9 6 L9 12"/></svg></template>
      </KeyValueRow>

      <KeyValueRow v-if="magicOpened" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.magic')">
        {{ t('levelUp.summary.magicOpened') }} <span class="lu-sum-pill">{{ t('levelUp.summary.pillOpen') }}</span>
        <template #icon><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2 L11 7 L16 8 L12 12 L13 17 L9 14 L5 17 L6 12 L2 8 L7 7 Z"/></svg></template>
      </KeyValueRow>

      <KeyValueRow v-if="maxHpDelta > 0" class="lu-sum-row" layout="stacked" tone="accent" :label="t('levelUp.summary.hp')">
        {{ newCurrentHp }} / {{ newMaxHp }}
        <template #icon><IconCheckCircle :size="18" :stroke-width="1.4" /></template>
        <template #action><span class="lu-sum-value is-hp">+{{ maxHpDelta }} <em>{{ t('levelUp.summary.was', { n: char.maxHp }) }}</em></span></template>
      </KeyValueRow>
    </div>
  </WizardSection>
</template>

<style scoped>
.lu-summary { display: flex; flex-direction: column; }
.lu-summary .lu-sum-row { padding: 12px 8px; }
.lu-sum-value {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  text-align: right;
}
.lu-sum-value em {
  font-family: var(--font-mono);
  font-size: 10px;
  font-style: normal;
  color: var(--vtt-text-muted);
  margin-left: 6px;
  letter-spacing: 0.08em;
}
.lu-sum-value.is-hp { color: var(--vtt-accent); font-size: 22px; }
.lu-sum-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  margin-left: 6px;
  background: var(--vtt-success-glow-a15);
  border-radius: var(--r-pill);
  color: var(--vtt-success);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  vertical-align: middle;
}
</style>
