<script setup lang="ts">
import { computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import { damageBreakdownLines, damageFormula } from '@/utils/derived'
import InfoPopover from './InfoPopover.vue'

const props = defineProps<{ char: Character; weapon: InventoryItem }>()

const lines = computed(() => damageBreakdownLines(props.char, props.weapon))
const total = computed(() => damageFormula(props.char, props.weapon))
</script>

<template>
  <InfoPopover v-if="lines.length">
    <div class="bd">
      <div v-for="(line, i) in lines" :key="i" class="bd__row">
        <span class="bd__val">{{ line.value }}</span>
        <span class="bd__label">{{ line.label }}</span>
      </div>
      <div class="bd__divider" />
      <div class="bd__row bd__row--total">
        <span class="bd__val">{{ total }}</span>
        <span class="bd__label">итого</span>
      </div>
    </div>
  </InfoPopover>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 4px; }
.bd__row { display: flex; gap: 12px; align-items: baseline; }
.bd__val { font-family: monospace; font-weight: 600; min-width: 44px; text-align: right; }
.bd__label { color: var(--color-text-muted); }
.bd__divider { border-top: 1px solid var(--color-border); margin: 4px 0; }
.bd__row--total .bd__val { color: var(--color-accent); }
.bd__row--total .bd__label { color: var(--color-text); }
</style>
