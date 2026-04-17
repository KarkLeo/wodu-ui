<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, StatKey } from '@/types/character'
import { STAT_KEYS, STAT_LABELS, MAX_STAT_BONUS } from '@/data/xpTable'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [key: StatKey] }>()

const picked = ref<StatKey | null>(null)
const available = computed(() => STAT_KEYS.filter(k => props.char.stats[k] < MAX_STAT_BONUS))
</script>

<template>
  <section class="step">
    <div class="label">+1 к характеристике (макс +{{ MAX_STAT_BONUS }})</div>
    <div class="grid">
      <label v-for="k in STAT_KEYS" :key="k" class="cell" :class="{ 'cell--picked': picked === k, 'cell--disabled': !available.includes(k) }">
        <input type="radio" :value="k" v-model="picked" :disabled="!available.includes(k)" />
        <span class="cell__name">{{ STAT_LABELS[k] }}</span>
        <span class="cell__val">{{ char.stats[k] }} → {{ Math.min(MAX_STAT_BONUS, char.stats[k] + 1) }}</span>
      </label>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cell { padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; flex-direction: column; gap: 2px; text-align: center; cursor: pointer; }
.cell--picked { border-color: var(--color-accent); }
.cell--disabled { opacity: 0.3; cursor: not-allowed; }
.cell__name { font-weight: 600; }
.cell__val { font-size: 12px; color: var(--color-text-muted); }
</style>
