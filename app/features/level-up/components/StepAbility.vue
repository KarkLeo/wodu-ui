<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITY_IDS } from '@/types/character'
import { getAbilityEffect } from '@/data/abilities'
import StateNote from '@/components/ui/StateNote.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableRow from '@/components/ui/SelectableRow.vue'
import Pill from '@/components/ui/Pill.vue'
import { t } from '@/locales'
import { abilityName, abilityDescription } from '@/locales/content'

const props = defineProps<{ char: Character; currentAbilityIds: readonly AbilityId[]; selected: AbilityId | null }>()
const emit = defineEmits<{ 'update:selected': [id: AbilityId] }>()

const available = computed(() => ABILITY_IDS.filter(id => !props.currentAbilityIds.includes(id)))

function chipFor(id: AbilityId): { text: string; tone: 'accent' | 'danger' } | null {
  const eff = getAbilityEffect(id)
  if (!eff) return null
  if (eff.initMagicOnAcquire) return { text: t('levelUp.steps.ability.chipMagicOpen'), tone: 'accent' }
  if (eff.hpBonusOnAcquire) return { text: t('levelUp.steps.ability.chipSturdy', { n: eff.hpBonusOnAcquire }), tone: 'danger' }
  return null
}
</script>

<template>
  <div class="cc-section">
    <SectionHeader :title="t('levelUp.steps.ability.label')" :hint="t('levelUp.steps.ability.hint')" />
    <div v-if="available.length" role="radiogroup" :aria-label="t('levelUp.steps.ability.label')">
      <SelectableRow
        v-for="id in available"
        :key="id"
        type="radio"
        :title="abilityName(id)"
        :description="abilityDescription(id)"
        :selected="selected === id"
        @toggle="emit('update:selected', id)"
      >
        <template v-if="chipFor(id)" #trailing>
          <Pill size="sm" :tone="chipFor(id)!.tone">{{ chipFor(id)!.text }}</Pill>
        </template>
      </SelectableRow>
    </div>
    <StateNote v-else size="sm">{{ t('levelUp.steps.ability.empty') }}</StateNote>
  </div>
</template>

<style scoped>
.cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
</style>
