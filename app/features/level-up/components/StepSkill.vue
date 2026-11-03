<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILL_IDS } from '@/types/character'
import StateNote from '@/components/ui/StateNote.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableRow from '@/components/ui/SelectableRow.vue'
import { t } from '@/locales'
import { skillName } from '@/locales/content'

const props = defineProps<{ char: Character; currentSkillIds: readonly SkillId[]; selected: SkillId | null }>()
const emit = defineEmits<{ 'update:selected': [id: SkillId] }>()

const available = computed(() => SKILL_IDS.filter(id => !props.currentSkillIds.includes(id)))
</script>

<template>
  <div class="cc-section">
    <SectionHeader :title="t('levelUp.steps.skill.label')" :hint="t('levelUp.steps.skill.hint')" />
    <div v-if="available.length" role="radiogroup" :aria-label="t('levelUp.steps.skill.label')">
      <SelectableRow
        v-for="id in available"
        :key="id"
        type="radio"
        :title="skillName(id)"
        :selected="selected === id"
        @toggle="emit('update:selected', id)"
      />
    </div>
    <StateNote v-else size="sm">{{ t('levelUp.steps.skill.empty') }}</StateNote>
  </div>
</template>

<style scoped>
.cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
</style>
