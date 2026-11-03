<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITY_IDS } from '@/types/character'
import { getAbilityEffect } from '@/data/abilities'
import WizardSection from '@/components/layout/WizardSection.vue'
import StateNote from '@/components/ui/StateNote.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableRow from '@/components/ui/SelectableRow.vue'
import Pill from '@/components/ui/Pill.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { t } from '@/locales'
import { abilityName, abilityDescription } from '@/locales/content'

const props = defineProps<{ char: Character; currentAbilityIds: readonly AbilityId[] }>()
const selected = defineModel<AbilityId | null>('selected', { required: true })

const available = computed(() => ABILITY_IDS.filter(id => !props.currentAbilityIds.includes(id)))
const { tabIndexFor, onKeydown } = useRovingSelection(() => available.value.map(value => ({ value })), selected)

function chipFor(id: AbilityId): { text: string; tone: 'accent' | 'danger' } | null {
  const eff = getAbilityEffect(id)
  if (!eff) return null
  if (eff.initMagicOnAcquire) return { text: t('levelUp.steps.ability.chipMagicOpen'), tone: 'accent' }
  if (eff.hpBonusOnAcquire) return { text: t('levelUp.steps.ability.chipSturdy', { n: eff.hpBonusOnAcquire }), tone: 'danger' }
  return null
}
</script>

<template>
  <WizardSection>
    <SectionHeader :title="t('levelUp.steps.ability.label')" :hint="t('levelUp.steps.ability.hint')" />
    <div v-if="available.length" role="radiogroup" :aria-label="t('levelUp.steps.ability.label')">
      <SelectableRow
        v-for="id in available"
        :key="id"
        type="radio"
        :title="abilityName(id)"
        :description="abilityDescription(id)"
        :selected="selected === id"
        :tabindex="tabIndexFor(id)"
        @keydown="onKeydown"
        @toggle="selected = id"
      >
        <template v-if="chipFor(id)" #trailing>
          <Pill size="sm" :tone="chipFor(id)!.tone">{{ chipFor(id)!.text }}</Pill>
        </template>
      </SelectableRow>
    </div>
    <StateNote v-else size="sm">{{ t('levelUp.steps.ability.empty') }}</StateNote>
  </WizardSection>
</template>
