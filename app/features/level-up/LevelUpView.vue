<script setup lang="ts">
import { computed, h, onMounted, ref, watch, type FunctionalComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useLevelUp } from '@/composables/useLevelUp'
import { useTable } from '@/composables/useTable'
import type { SkillId, AbilityId, StatKey } from '@/types/character'
import { t } from '@/locales'
import { skillName as skillNameOf, abilityName as abilityNameOf, statShort } from '@/locales/content'
import StepSkill from './components/StepSkill.vue'
import StepAbility from './components/StepAbility.vue'
import StepStat from './components/StepStat.vue'
import StepHitDice from './components/StepHitDice.vue'
import StepSummary from './components/StepSummary.vue'
import WizardShell from '@/components/layout/WizardShell.vue'
import WizardStepper from '@/components/layout/WizardStepper.vue'
import IconCheckBold from '@/components/ui/icons/IconCheckBold.vue'

const IconConfirm: FunctionalComponent = () => h(IconCheckBold, { strokeWidth: 1.6 })

const router = useRouter()
const { partyRoute, tableRoute } = useTable()
const { id, char, dispatch } = useActiveCharacter()
const lv = useLevelUp(char, dispatch)

const skillSel = ref<SkillId | null>(null)
const abilitySel = ref<AbilityId | null>(null)
const statSel = ref<StatKey | null>(null)
const hitDiceTotal = ref<number | null>(null)

watch([() => lv.phase.value, () => lv.targetLevel.value], () => {
  skillSel.value = null
  abilitySel.value = null
  statSel.value = null
  hitDiceTotal.value = null
})

const totalDots = computed(() => lv.activeSteps.value.length + 1)

const previousMaxHp = computed(() => lv.pending.value.maxHp ?? char.value?.maxHp ?? 0)

const canAdvance = computed(() => {
  switch (lv.phase.value) {
    case 'skill': return skillSel.value !== null
    case 'ability': return abilitySel.value !== null
    case 'stat': return statSel.value !== null
    case 'hitDice': return hitDiceTotal.value !== null && hitDiceTotal.value > 0
    case 'confirm': return true
  }
  return false
})

const footerHint = computed(() => {
  switch (lv.phase.value) {
    case 'skill': {
      if (!skillSel.value) return t('levelUp.footer.needPick')
      const name = skillNameOf(skillSel.value)
      return t('levelUp.footer.pickSkill', { name })
    }
    case 'ability': {
      if (!abilitySel.value) return t('levelUp.footer.needPick')
      const name = abilityNameOf(abilitySel.value)
      return t('levelUp.footer.pickAbility', { name })
    }
    case 'stat': {
      if (!statSel.value || !char.value) return t('levelUp.footer.needPick')
      const from = lv.currentStats.value?.[statSel.value] ?? 0
      return t('levelUp.footer.pickStat', { label: statShort(statSel.value), from, to: from + 1 })
    }
    case 'hitDice': {
      if (!hitDiceTotal.value) return t('levelUp.footer.rollToContinue')
      return t('levelUp.footer.hpInfo', { new: Math.max(previousMaxHp.value, hitDiceTotal.value), old: previousMaxHp.value })
    }
    case 'confirm': return t('levelUp.footer.allReady')
  }
  return ''
})

const stepTitle = computed(() => {
  switch (lv.phase.value) {
    case 'skill': return t('levelUp.steps.skill.label')
    case 'ability': return t('levelUp.steps.ability.label')
    case 'stat': return t('levelUp.steps.stat.label')
    case 'hitDice': return t('levelUp.steps.hitDice.label')
    case 'confirm': return t('levelUp.summaryTitle')
  }
  return ''
})

const currentIndex = computed(() => lv.currentStepIndex.value)

function onPrimary() {
  switch (lv.phase.value) {
    case 'skill':
      if (skillSel.value) lv.pickSkill(skillSel.value)
      return
    case 'ability':
      if (abilitySel.value) lv.pickAbility(abilitySel.value)
      return
    case 'stat':
      if (statSel.value) lv.bumpStat(statSel.value)
      return
    case 'hitDice':
      if (hitDiceTotal.value !== null) lv.onHitDice(hitDiceTotal.value)
      return
    case 'confirm':
      lv.confirm()
      router.push(partyRoute([id.value]))
      return
  }
}

function onBack() {
  if (!lv.goBack()) router.push(partyRoute([id.value]))
}

function onClose() {
  router.push(partyRoute([id.value]))
}

onMounted(() => {
  if (!char.value || !lv.reward.value) {
    router.push(tableRoute())
    return
  }
  lv.init()
})
</script>

<template>
  <WizardShell
    v-if="char && lv.reward.value"
    :title="stepTitle"
    :hint="footerHint"
    :close-label="t('levelUp.close')"
    :back-label="t('levelUp.back')"
    :next-label="lv.phase.value === 'confirm' ? t('levelUp.confirm') : t('levelUp.next')"
    :next-icon="lv.phase.value === 'confirm' ? IconConfirm : undefined"
    :next-disabled="!canAdvance"
    @close="onClose"
    @back="onBack"
    @next="onPrimary"
  >
    <template #subtitle>
      {{ t('levelUp.title') }} · {{ char.level }}<span class="lu-arrow"> → </span>{{ lv.targetLevel.value }}
    </template>
    <template #stepper>
      <WizardStepper :count="totalDots" :current="currentIndex + 1" />
    </template>
    <StepSkill
      v-if="lv.phase.value === 'skill'"
      :char="char"
      :current-skill-ids="lv.currentSkillIds.value"
      :selected="skillSel"
      @update:selected="skillSel = $event"
    />
    <StepAbility
      v-else-if="lv.phase.value === 'ability'"
      :char="char"
      :current-ability-ids="lv.currentAbilityIds.value"
      :selected="abilitySel"
      @update:selected="abilitySel = $event"
    />
    <StepStat
      v-else-if="lv.phase.value === 'stat' && lv.currentStats.value"
      :char="char"
      :current-stats="lv.currentStats.value"
      :selected="statSel"
      @update:selected="statSel = $event"
    />
    <StepHitDice
      v-else-if="lv.phase.value === 'hitDice'"
      :num-dice="(char.hitDice ?? 1) + 1"
      :target-level="lv.targetLevel.value"
      :character-id="id"
      :character-name="char.name"
      :previous-max-hp="previousMaxHp"
      @update:result="hitDiceTotal = $event"
    />
    <StepSummary
      v-else-if="lv.phase.value === 'confirm'"
      :char="char"
      :pending="lv.pending.value"
      :target-level="lv.targetLevel.value"
    />
  </WizardShell>
</template>

<style scoped>
.lu-arrow { color: var(--vtt-accent); margin: 0 3px; }
</style>
