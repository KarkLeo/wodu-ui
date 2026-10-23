<script setup lang="ts">
import type { Character, StatKey, Stats } from '@/types/character'
import { STAT_KEYS, MAX_STAT_BONUS } from '@/data/xpTable'
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
        <span class="cc-attr-label">{{ statShort(k) }}</span>
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

<style scoped src="./stepShared.css"></style>

<style scoped>
.cc-attr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
.cc-attr {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: "label label" "value value";
  column-gap: 8px;
  padding: 10px 12px 12px;
  border-radius: var(--r-md);
  background: rgba(36, 28, 21, 0.4);
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: all var(--t-fast) var(--ease);
}
.cc-attr:hover:not(:disabled) { background: rgba(36, 28, 21, 0.65); }
.cc-attr:disabled { opacity: 0.4; cursor: not-allowed; }
.cc-attr-label {
  grid-area: label;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  line-height: 1;
}
.cc-attr-value {
  grid-area: value;
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
.cc-attr.is-selected {
  background: rgba(140, 106, 58, 0.2);
  border-color: rgba(140, 106, 58, 0.55);
}
.cc-attr.is-selected .cc-attr-mod {
  color: var(--vtt-accent);
  text-shadow: 0 0 12px rgba(212, 168, 87, 0.4);
}
.cc-attr:disabled .cc-attr-next { color: var(--vtt-danger-bright); opacity: 0.7; }
</style>
