<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { armorBreakdownLines, totalArmor } from '@/utils/derived'
import InfoPopover from './InfoPopover.vue'

const props = defineProps<{ char: Character }>()

const breakdown = computed(() => armorBreakdownLines(props.char))
const total = computed(() => totalArmor(props.char))
</script>

<template>
  <InfoPopover>
    <div class="bd">
      <div v-for="(line, i) in breakdown.lines" :key="i" class="bd__row">
        <span class="bd__val">{{ line.value }}</span>
        <span class="bd__label">{{ line.label }}</span>
      </div>
      <div v-if="!breakdown.lines.length" class="bd__row">
        <span class="bd__val">0</span>
        <span class="bd__label">без доспеха</span>
      </div>
      <div class="bd__divider" />
      <div class="bd__row bd__row--total">
        <span class="bd__val">{{ total }}</span>
        <span class="bd__label">итого броня</span>
      </div>
      <div v-if="breakdown.note" class="bd__note">* {{ breakdown.note }}</div>
    </div>
  </InfoPopover>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 4px; }
.bd__row { display: flex; gap: 12px; align-items: baseline; }
.bd__val { font-family: monospace; font-weight: 600; min-width: 36px; text-align: right; }
.bd__label { color: var(--color-text-muted); }
.bd__divider { border-top: 1px solid var(--color-border); margin: 4px 0; }
.bd__row--total .bd__val { color: var(--color-accent); }
.bd__row--total .bd__label { color: var(--color-text); }
.bd__note { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }
</style>
