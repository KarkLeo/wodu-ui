<script setup lang="ts">
import type { Character, StatKey, Stats } from '@/types/character'
import { STAT_KEYS, MAX_STAT_BONUS } from '@/data/xpTable'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableTile from '@/components/ui/SelectableTile.vue'
import { t } from '@/locales'
import { statShort } from '@/locales/content'

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
    <SectionHeader :title="t('levelUp.steps.stat.label')" :hint="t('levelUp.steps.stat.hint', { max: MAX_STAT_BONUS })" />
    <div class="cc-attr-grid" role="radiogroup" :aria-label="t('levelUp.steps.stat.label')">
      <SelectableTile
        v-for="k in STAT_KEYS"
        :key="k"
        size="sm"
        :label="statShort(k)"
        :class="{ 'is-picked': selected === k, 'is-capped': !canBump(k) }"
        :selected="selected === k"
        :disabled="!canBump(k)"
        @select="emit('update:selected', k)"
      >
        <span class="cc-attr-value">
          <span class="cc-attr-mod">{{ formatMod(currentStats[k]) }}</span>
          <span class="cc-attr-next">
            <template v-if="canBump(k)">→ <em>{{ formatMod(currentStats[k] + 1) }}</em></template>
            <template v-else>{{ t('levelUp.steps.stat.max') }}</template>
          </span>
        </span>
      </SelectableTile>
    </div>
  </div>
</template>

<style scoped>
.cc-section { display: flex; flex-direction: column; gap: var(--s-3); }
.cc-attr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
.cc-attr-value {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}
.cc-attr-mod {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  line-height: 1;
}
.cc-attr-next {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.cc-attr-next em { color: var(--vtt-accent); font-style: normal; }
.is-picked .cc-attr-mod {
  color: var(--vtt-accent);
  text-shadow: 0 0 12px rgba(212, 168, 87, 0.4);
}
.is-capped .cc-attr-next { color: var(--vtt-danger-bright); opacity: 0.7; }
</style>
