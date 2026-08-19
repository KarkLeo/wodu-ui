<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character } from '@/types/character'
import { ABILITY_IDS } from '@/types/character'
import AbilityCard from '@/components/ui/AbilityCard.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { t } from '@/locales'
import { abilityName, abilityDescription } from '@/locales/content'

const props = defineProps<{ char: Character }>()

const items = computed(() =>
  ABILITY_IDS.filter(id => props.char.abilityIds.includes(id)),
)

const sheetOpen = ref(false)
</script>

<template>
  <section class="abilities-section">
    <div class="abilities-section-head">
      <span class="abilities-section-title">{{ t('inGame.abilities.title') }}</span>
      <button
        type="button"
        class="abilities-section-link"
        @click="sheetOpen = true"
      >
        {{ t('inGame.abilities.all') }}
      </button>
    </div>
    <div v-if="items.length" class="abilities-list">
      <AbilityCard
        v-for="id in items"
        :key="id"
        :title="abilityName(id)"
        mode="display"
      >
        {{ abilityDescription(id) }}
      </AbilityCard>
    </div>
    <div v-else class="abilities-empty">{{ t('inGame.abilities.empty') }}</div>
  </section>

  <BottomSheet v-model:open="sheetOpen" :title="t('inGame.abilities.allTitle')">
    <AbilityCard
      v-for="id in ABILITY_IDS"
      :key="id"
      :title="abilityName(id)"
      mode="display"
      variant="reference"
    >
      {{ abilityDescription(id) }}
    </AbilityCard>
  </BottomSheet>
</template>

<style scoped>
.abilities-section {
  padding: 14px 16px;
}
.abilities-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.abilities-section-title {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.abilities-section-link {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--r-xs);
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.abilities-section-link:hover {
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-surface);
}
.abilities-list {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.abilities-empty {
  font-size: 13px;
  color: var(--vtt-text-muted);
  font-style: italic;
}
</style>
