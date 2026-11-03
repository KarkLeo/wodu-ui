<script setup lang="ts">
import type { Character, StatKey, Stats } from '@/types/character'
import { STAT_KEYS, MAX_STAT_BONUS } from '@/data/xpTable'
import WizardSection from '@/components/layout/WizardSection.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import SelectableTile from '@/components/ui/SelectableTile.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'
import { t } from '@/locales'
import { statShort } from '@/locales/content'

const props = defineProps<{ char: Character; currentStats: Stats }>()
const selected = defineModel<StatKey | null>('selected', { required: true })

function canBump(k: StatKey) {
  return props.currentStats[k] < MAX_STAT_BONUS
}
function formatMod(n: number) {
  return n > 0 ? `+${n}` : String(n)
}

const { tabIndexFor, onKeydown } = useRovingSelection(
  () => STAT_KEYS.map(value => ({ value, disabled: !canBump(value) })),
  selected,
)
</script>

<template>
  <WizardSection>
    <SectionHeader :title="t('levelUp.steps.stat.label')" :hint="t('levelUp.steps.stat.hint', { max: MAX_STAT_BONUS })" />
    <div class="cc-attr-grid" role="radiogroup" :aria-label="t('levelUp.steps.stat.label')">
      <SelectableTile
        v-for="k in STAT_KEYS"
        :key="k"
        size="sm"
        :label="statShort(k)"
        :value="formatMod(currentStats[k])"
        :selected="selected === k"
        :disabled="!canBump(k)"
        :tabindex="tabIndexFor(k)"
        @keydown="onKeydown"
        @select="selected = k"
      >
        <span class="cc-attr-next">
          <template v-if="canBump(k)">→ <em>{{ formatMod(currentStats[k] + 1) }}</em></template>
          <template v-else>{{ t('levelUp.steps.stat.max') }}</template>
        </span>
      </SelectableTile>
    </div>
  </WizardSection>
</template>

<style scoped>
.cc-attr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
.cc-attr-next {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.cc-attr-next em { color: var(--vtt-accent); font-style: normal; }
:disabled .cc-attr-next { color: var(--vtt-danger-bright); opacity: 0.7; }
</style>
