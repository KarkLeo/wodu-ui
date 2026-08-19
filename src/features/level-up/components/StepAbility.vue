<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITY_IDS } from '@/types/character'
import { getAbilityEffect } from '@/data/abilities'
import { t } from '@/locales'
import { abilityName, abilityDescription } from '@/locales/content'

const props = defineProps<{ char: Character; currentAbilityIds: readonly AbilityId[]; selected: AbilityId | null }>()
const emit = defineEmits<{ 'update:selected': [id: AbilityId] }>()

const available = computed(() => ABILITY_IDS.filter(id => !props.currentAbilityIds.includes(id)))

function chipFor(id: AbilityId): { text: string; variant: 'magic' | 'danger' } | null {
  const eff = getAbilityEffect(id)
  if (!eff) return null
  if (eff.initMagicOnAcquire) return { text: t('levelUp.steps.ability.chipMagicOpen'), variant: 'magic' }
  if (eff.hpBonusOnAcquire) return { text: t('levelUp.steps.ability.chipSturdy', { n: eff.hpBonusOnAcquire }), variant: 'danger' }
  return null
}
</script>

<template>
  <div class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('levelUp.steps.ability.label') }}</span>
      <span class="cc-section-hint">{{ t('levelUp.steps.ability.hint') }}</span>
    </div>
    <div v-if="available.length" class="cc-abil-list">
      <button
        v-for="id in available"
        :key="id"
        type="button"
        class="cc-abil"
        :class="{ 'is-selected': selected === id }"
        @click="emit('update:selected', id)"
      >
        <span class="cc-check" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
        </span>
        <span class="cc-abil-body-text">
          <span class="cc-abil-name">{{ abilityName(id) }}</span>
          <span class="cc-abil-desc">{{ abilityDescription(id) }}</span>
        </span>
        <span v-if="chipFor(id)" class="cc-abil-chip" :class="`is-${chipFor(id)!.variant}`">
          {{ chipFor(id)!.text }}
        </span>
      </button>
    </div>
    <div v-else class="lu-empty">{{ t('levelUp.steps.ability.empty') }}</div>
  </div>
</template>
