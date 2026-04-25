<script setup lang="ts">
import type { Character, StatKey, Stats } from '@/types/character'
import { STAT_KEYS, STAT_LABELS, MAX_STAT_BONUS } from '@/data/xpTable'
import { t } from '@/locales'

const props = defineProps<{ char: Character; currentStats: Stats; selected: StatKey | null }>()
const emit = defineEmits<{ 'update:selected': [key: StatKey] }>()

function canBump(k: StatKey) {
  return props.currentStats[k] < MAX_STAT_BONUS
}
function formatMod(n: number) {
  return n > 0 ? `+${n}` : String(n)
}
</script>

<template>
  <div class="cc-section">
    <div class="cc-section-head">
      <span class="cc-section-label">{{ t('levelUp.steps.stat.label') }}</span>
      <span class="cc-section-hint">{{ t('levelUp.steps.stat.hint', { max: MAX_STAT_BONUS }) }}</span>
    </div>
    <div class="cc-attr-grid">
      <button
        v-for="k in STAT_KEYS"
        :key="k"
        type="button"
        class="cc-attr"
        :class="{ 'is-selected': selected === k }"
        :disabled="!canBump(k)"
        @click="canBump(k) && emit('update:selected', k)"
      >
        <span class="cc-attr-label">{{ STAT_LABELS[k] }}</span>
        <span class="cc-attr-value">
          <span class="cc-attr-mod">{{ formatMod(currentStats[k]) }}</span>
          <span class="cc-attr-next">
            <template v-if="canBump(k)">→ <em>{{ formatMod(currentStats[k] + 1) }}</em></template>
            <template v-else>{{ t('levelUp.steps.stat.max') }}</template>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>
