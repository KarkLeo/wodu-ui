<script setup lang="ts">
import { computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITIES } from '@/types/character'
import { getAbilityEffect } from '@/data/abilities'
import { t } from '@/locales'

const props = defineProps<{ char: Character; currentAbilityIds: readonly AbilityId[]; selected: AbilityId | null }>()
const emit = defineEmits<{ 'update:selected': [id: AbilityId] }>()

const available = computed(() => ABILITIES.filter(a => !props.currentAbilityIds.includes(a.id)))

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
        v-for="a in available"
        :key="a.id"
        type="button"
        class="cc-abil"
        :class="{ 'is-selected': selected === a.id }"
        @click="emit('update:selected', a.id)"
      >
        <span class="cc-check" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5 L5 8.5 L9 4"/></svg>
        </span>
        <span class="cc-abil-body-text">
          <span class="cc-abil-name">{{ a.name }}</span>
          <span class="cc-abil-desc">{{ a.description }}</span>
        </span>
        <span v-if="chipFor(a.id)" class="cc-abil-chip" :class="`is-${chipFor(a.id)!.variant}`">
          {{ chipFor(a.id)!.text }}
        </span>
      </button>
    </div>
    <div v-else class="lu-empty">{{ t('levelUp.steps.ability.empty') }}</div>
  </div>
</template>
