<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useTable } from '@/composables/useTable'
import { useCreationStore } from '@/stores/creation'
import { useCharactersStore } from '@/stores/characters'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { t } from '@/locales'
import { className as classNameOf } from '@/locales/content'
import StepIdentity from './steps/StepIdentity.vue'
import StepTraining from './steps/StepTraining.vue'
import StepGear from './steps/StepGear.vue'
import WizardShell from '@/components/layout/WizardShell.vue'
import WizardStepper from '@/components/layout/WizardStepper.vue'
import IconStarBold from '@/components/ui/icons/IconStarBold.vue'

const router = useRouter()
const { tableRoute } = useTable()
const creation = useCreationStore()
const characters = useCharactersStore()
const {
  draft, step, isStepValid, allRolled, next, back, finish,
  autoSkills, autoAbilities, requiredSkillPicks, requiredAbilityPicks,
} = useCharacterCreation()

const stepComponents = [StepIdentity, StepTraining, StepGear]
const currentStepComponent = computed(() => stepComponents[step.value - 1])

const stepTitle = computed(() => {
  if (step.value === 1) return t('characterCreation.steps.s1Title')
  if (step.value === 2) return t('characterCreation.steps.s2Title')
  return t('characterCreation.steps.s3Title')
})

const className = computed(() => {
  if (!draft.value) return ''
  if (draft.value.classId === 'custom') return draft.value.customClassName?.trim() || classNameOf('custom')
  return classNameOf(draft.value.classId)
})

const footerHint = computed(() => {
  if (!draft.value) return ''
  const d = draft.value
  if (step.value === 1) {
    if (!d.name.trim()) return t('characterCreation.footerHint.needName')
    if (d.classId === 'custom' && !d.customClassName?.trim()) return t('characterCreation.footerHint.needCustomClass')
    if (!allRolled.value) return t('characterCreation.footerHint.needStats')
    return t('characterCreation.footerHint.s1Ready', { name: d.name.split(' ')[0] || d.name, className: className.value })
  }
  if (step.value === 2) {
    const skillsLeft = requiredSkillPicks.value - d.skillIds.filter(id => !autoSkills.value.includes(id)).length
    if (skillsLeft > 0) return t('characterCreation.footerHint.s2NeedSkills', { count: skillsLeft })
    const abilitiesLeft = requiredAbilityPicks.value - d.abilityIds.filter(id => !autoAbilities.value.includes(id)).length
    if (abilitiesLeft > 0) return t('characterCreation.footerHint.s2NeedAbilities', { count: abilitiesLeft })
    return t('characterCreation.footerHint.s2Ready', { className: className.value })
  }
  if (d.maxHp === 0) return t('characterCreation.footerHint.s3NeedHp')
  return t('characterCreation.footerHint.s3Ready')
})

function onDotClick(n: number) {
  if (n >= step.value) return
  while (creation.step > n) creation.prevStep()
}

async function onClose() {
  if (creation.draftId) {
    try { await characters.remove(creation.draftId) } catch { /* logged in store */ }
  }
  creation.reset()
  router.push(tableRoute())
}

function onNextOrFinish() {
  if (step.value === 3) finish()
  else next()
}

// A persisted draftId can outlive its record (deleted elsewhere, or never saved before a reload).
// Judge only once the data is loaded: during a server outage the store is empty but the pointer is fine.
// Only in the mode this wizard opened in: the mode switches before the page unmounts when the address
// changes area, and the other mode's (still empty) store would reset that mode's draft pointer.
const openedIn = mode.value
let staleChecked = false
watch(onlineDataReady, (ready) => {
  if (!ready || staleChecked || mode.value !== openedIn) return
  staleChecked = true
  if (draft.value) return
  creation.reset()
  router.push(tableRoute())
}, { immediate: true })
</script>

<template>
  <WizardShell
    v-if="draft"
    :title="stepTitle"
    :hint="footerHint"
    :close-label="t('characterCreation.shell.close')"
    :back-label="t('characterCreation.shell.back')"
    :next-label="step === 3 ? t('characterCreation.shell.create') : t('characterCreation.shell.next')"
    :next-icon="step === 3 ? IconStarBold : undefined"
    :next-disabled="!isStepValid"
    @close="onClose"
    @back="back"
    @next="onNextOrFinish"
  >
    <template #stepper>
      <WizardStepper :count="3" :current="step" navigable @select="onDotClick" />
    </template>
    <component :is="currentStepComponent" />
  </WizardShell>
</template>
