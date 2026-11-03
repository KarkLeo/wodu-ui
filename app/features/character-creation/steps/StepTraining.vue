<script setup lang="ts">
import { computed } from 'vue'
import type { SkillId, AbilityId, Spirit, Ritual } from '@/types/character'
import { SKILL_IDS, ABILITY_IDS } from '@/types/character'
import { hasMagicAbility } from '@/data/abilities'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import SpiritCard from '@/features/in-game/components/magic/SpiritCard.vue'
import RitualCard from '@/features/in-game/components/magic/RitualCard.vue'
import CantripChip from '@/features/in-game/components/magic/CantripChip.vue'
import WizardSection from '@/components/layout/WizardSection.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SelectableRow from '@/components/ui/SelectableRow.vue'
import SkillChip from '@/components/ui/SkillChip.vue'
import Pill from '@/components/ui/Pill.vue'
import IconLock from '@/components/ui/icons/IconLock.vue'
import { t } from '@/locales'
import { skillName, abilityName, abilityDescription, cantripName } from '@/locales/content'

const {
  draft,
  classData,
  autoSkills,
  autoAbilities,
  requiredSkillPicks,
  requiredAbilityPicks,
  toggleSkill,
  toggleAbility,
  updateMagic,
} = useCharacterCreation()

const abilityPool = computed<AbilityId[]>(() => classData.value?.abilityPool ?? [])

const pickedSkills = computed(() =>
  (draft.value?.skillIds ?? []).filter(id => !autoSkills.value.includes(id)),
)
const pickedAbilities = computed(() =>
  (draft.value?.abilityIds ?? []).filter(id => !autoAbilities.value.includes(id)),
)

const abilitySlotsFull = computed(() => pickedAbilities.value.length >= requiredAbilityPicks.value)
const skillSlotsFull = computed(() => pickedSkills.value.length >= requiredSkillPicks.value)

function updateSpirit(idx: number, patchSp: Partial<Spirit>) {
  const magic = draft.value?.magic
  if (!magic) return
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patchSp } : s))
  updateMagic({ ...magic, spirits })
}
function removeSpirit(idx: number) {
  const magic = draft.value?.magic
  if (!magic) return
  const spirits = magic.spirits.filter((_, i) => i !== idx)
  updateMagic({ ...magic, spirits })
}

function updateRitual(idx: number, patchRit: Partial<Ritual>) {
  const magic = draft.value?.magic
  if (!magic) return
  const rituals = [...(magic.rituals ?? [])]
  while (rituals.length < 2) rituals.push({ name: '', description: '' })
  rituals[idx] = { ...rituals[idx], ...patchRit }
  updateMagic({ ...magic, rituals })
}
function removeRitual(idx: number) {
  const magic = draft.value?.magic
  if (!magic) return
  const rituals = (magic.rituals ?? []).filter((_, i) => i !== idx)
  updateMagic({ ...magic, rituals })
}

const showMagic = computed(() =>
  draft.value?.classId === 'wizard' || hasMagicAbility(draft.value?.abilityIds ?? []),
)
const cantrips = computed<string[]>(() => draft.value?.magic?.cantrips ?? [])
const hasRitualAbility = computed(() => pickedAbilities.value.includes('ritual'))

const visibleAbilities = computed(() => {
  const allowed = new Set<AbilityId>([...autoAbilities.value, ...abilityPool.value])
  return ABILITY_IDS.filter(id => allowed.has(id))
})

const abilitiesCounterText = computed(() =>
  t('characterCreation.training.abilitiesCounter', {
    picked: autoAbilities.value.length + pickedAbilities.value.length,
    total: 2,
  }),
)
const skillsCounterText = computed(() =>
  t('characterCreation.training.skillsCounter', {
    picked: autoSkills.value.length + pickedSkills.value.length,
    total: 2,
  }),
)

const abilitiesHint = computed(() => {
  if (autoAbilities.value.length > 0) {
    return t('characterCreation.training.abilitiesHintLocked', {
      locked: autoAbilities.value.length,
      count: requiredAbilityPicks.value,
    })
  }
  return t('characterCreation.training.abilitiesHint', {
    count: requiredAbilityPicks.value,
    total: abilityPool.value.length,
  })
})
const skillsHint = computed(() => {
  if (autoSkills.value.length > 0) {
    const autoNames = autoSkills.value.map(id => skillName(id)).join(', ')
    if (requiredSkillPicks.value === 0) return t('characterCreation.training.skillsHintAllLocked', { auto: autoNames })
    return t('characterCreation.training.skillsHintLocked', { auto: autoNames, count: requiredSkillPicks.value })
  }
  return t('characterCreation.training.skillsHint', { count: requiredSkillPicks.value })
})

function abilState(id: AbilityId): { selected: boolean; auto: boolean; disabled: boolean } {
  const auto = autoAbilities.value.includes(id)
  const selected = draft.value?.abilityIds.includes(id) ?? false
  const inPool = abilityPool.value.includes(id) || auto
  const disabled = !auto && (!inPool || (!selected && abilitySlotsFull.value))
  return { selected, auto, disabled }
}

function skillIsLocked(id: SkillId): boolean {
  return autoSkills.value.includes(id)
}

function skillState(id: SkillId): 'auto' | 'selected' | 'locked' | 'default' {
  if (skillIsLocked(id)) return 'auto'
  if (draft.value?.skillIds.includes(id)) return 'selected'
  return skillSlotsFull.value ? 'locked' : 'default'
}

function abilFlag(id: AbilityId): string | undefined {
  const st = abilState(id)
  if (st.auto) return t('characterCreation.training.abilFlagAuto')
  if (!st.selected && st.disabled) return t('characterCreation.training.abilFlagNoSlots')
  if (st.selected) return t('characterCreation.training.abilFlagSelected')
  return undefined
}

function onSkillClick(id: SkillId) {
  if (skillIsLocked(id)) return
  if (!draft.value?.skillIds.includes(id) && skillSlotsFull.value) return
  toggleSkill(id)
}
function onAbilityClick(id: AbilityId) {
  const st = abilState(id)
  if (st.auto || st.disabled) return
  toggleAbility(id)
}
</script>

<template>
  <template v-if="draft">
  <WizardSection>
    <SectionHeader :title="t('characterCreation.training.skillsLabel')" :hint="skillsHint">
      <template #action><Pill tone="accent">{{ skillsCounterText }}</Pill></template>
    </SectionHeader>
    <div class="cc-skill-grid" role="group" :aria-label="t('characterCreation.training.skillsLabel')">
      <SkillChip
        v-for="id in SKILL_IDS"
        :key="id"
        mode="pick-multi"
        :label="skillName(id)"
        :state="skillState(id)"
        :icon="skillIsLocked(id) ? IconLock : undefined"
        @toggle="onSkillClick(id)"
      />
    </div>
  </WizardSection>

  <WizardSection>
    <SectionHeader :title="t('characterCreation.training.abilitiesLabel')" :hint="abilitiesHint">
      <template #action><Pill tone="accent">{{ abilitiesCounterText }}</Pill></template>
    </SectionHeader>
    <div role="group" :aria-label="t('characterCreation.training.abilitiesLabel')">
      <SelectableRow
        v-for="id in visibleAbilities"
        :key="id"
        :title="abilityName(id)"
        :description="abilityDescription(id)"
        :selected="abilState(id).selected"
        :locked="abilState(id).auto"
        :disabled="abilState(id).disabled"
        :flag="abilFlag(id)"
        @toggle="onAbilityClick(id)"
      />
    </div>
  </WizardSection>

  <WizardSection v-if="showMagic">
    <SectionHeader
      :title="t('characterCreation.training.magicLabel')"
      :hint="draft.classId === 'wizard' ? t('characterCreation.training.magicHintWizard') : t('characterCreation.training.magicHintOther')"
    />

    <div class="cc-magic-group">
      <SectionLabel tone="neutral">{{ t('characterCreation.training.spiritsSection') }}</SectionLabel>
      <div class="cc-magic-stack">
        <SpiritCard
          v-for="(sp, idx) in (draft.magic?.spirits ?? [])"
          :key="sp.id"
          :spirit="sp"
          @update="p => updateSpirit(idx, p)"
          @remove="removeSpirit(idx)"
        />
      </div>
    </div>

    <div v-if="hasRitualAbility" class="cc-magic-group">
      <SectionLabel tone="neutral">{{ t('characterCreation.training.ritualsHint') }}</SectionLabel>
      <div class="cc-magic-stack">
        <RitualCard
          v-for="i in 2"
          :key="i"
          :ritual="(draft.magic?.rituals ?? [])[i - 1] ?? { name: '', description: '' }"
          @update="p => updateRitual(i - 1, p)"
          @remove="removeRitual(i - 1)"
        />
      </div>
    </div>

    <div v-if="cantrips.length" class="cc-magic-group">
      <SectionLabel tone="neutral">{{ t('characterCreation.training.cantripsSection') }}</SectionLabel>
      <div class="cc-cantrips-row">
        <CantripChip v-for="c in cantrips" :key="c" :name="cantripName(c)" />
      </div>
    </div>
  </WizardSection>
  </template>
</template>

<style scoped>
.cc-skill-grid { display: flex; flex-wrap: wrap; gap: 6px; }

.cc-magic-group { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.cc-magic-stack { display: flex; flex-direction: column; gap: 10px; }
.cc-cantrips-row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
