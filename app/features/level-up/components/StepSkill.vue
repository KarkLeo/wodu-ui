<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILL_IDS } from '@/types/character'
import WizardSection from '@/components/layout/WizardSection.vue'
import StateNote from '@/components/ui/StateNote.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableRow from '@/components/ui/SelectableRow.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { t } from '@/locales'
import { skillName } from '@/locales/content'

const props = defineProps<{ char: Character; currentSkillIds: readonly SkillId[] }>()
const selected = defineModel<SkillId | null>('selected', { required: true })

const available = computed(() => SKILL_IDS.filter(id => !props.currentSkillIds.includes(id)))
const { tabIndexFor, onKeydown } = useRovingSelection(() => available.value.map(value => ({ value })), selected)
</script>

<template>
  <WizardSection>
    <SectionHeader :title="t('levelUp.steps.skill.label')" :hint="t('levelUp.steps.skill.hint')" />
    <div v-if="available.length" role="radiogroup" :aria-label="t('levelUp.steps.skill.label')">
      <SelectableRow
        v-for="id in available"
        :key="id"
        type="radio"
        :title="skillName(id)"
        :selected="selected === id"
        :tabindex="tabIndexFor(id)"
        @keydown="onKeydown"
        @toggle="selected = id"
      />
    </div>
    <StateNote v-else size="sm">{{ t('levelUp.steps.skill.empty') }}</StateNote>
  </WizardSection>
</template>
