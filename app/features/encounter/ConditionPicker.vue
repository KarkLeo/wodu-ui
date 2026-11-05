<script setup lang="ts">
import ToggleChip from '@/components/ui/ToggleChip.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { conditionName } from '@/locales/content'
import { CONDITIONS, type ConditionId } from '@/types/encounter'
import { t } from '@/locales'

defineProps<{ conditions: readonly ConditionId[] }>()
defineEmits<{ (e: 'toggle', id: ConditionId): void }>()
</script>

<template>
  <div class="cp" role="group" :aria-label="t('encounter.card.conditions')">
    <SectionLabel tone="neutral" aria-hidden="true">{{ t('encounter.card.conditions') }}</SectionLabel>
    <div class="cp-list">
      <ToggleChip
        v-for="id in CONDITIONS"
        :key="id"
        :label="conditionName(id)"
        :pressed="conditions.includes(id)"
        @toggle="$emit('toggle', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.cp { display: flex; flex-direction: column; gap: 6px; }
.cp-list { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
