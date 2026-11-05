<script setup lang="ts">
import NumberedName from './NumberedName.vue'
import type { EncounterHit } from '@/types/encounter'
import { t } from '@/locales'

defineProps<{ hit: EncounterHit }>()
</script>

<template>
  <div class="hit-row">
    <div class="hit-row-body">
      <div class="hit-row-who">
        <b class="hit-row-target"><NumberedName :label="hit.target.name" /></b>
        <span class="hit-row-arrow" aria-hidden="true">←</span>
        <NumberedName class="hit-row-source" :label="hit.sourceName" />
      </div>
      <div class="hit-row-calc">{{ t('encounter.hit.roll', { total: hit.rollTotal, armor: hit.armor }) }}</div>
    </div>
    <div class="hit-row-amount">−{{ hit.amount }}</div>
  </div>
</template>

<style scoped>
.hit-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--s-2);
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--r-md);
  background: var(--vtt-danger-a14);
}
.hit-row-body { min-width: 0; }
.hit-row-who {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
  font-size: 12px;
  color: var(--vtt-text-secondary);
}
.hit-row-target { color: var(--vtt-text-primary); font-weight: 500; min-width: 0; flex-shrink: 1; }
.hit-row-source { min-width: 0; flex-shrink: 1; }
.hit-row-arrow { flex-shrink: 0; }
.hit-row-calc {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.hit-row-amount {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-danger-bright);
}
</style>
