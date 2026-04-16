<script setup lang="ts">
import type { Character, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ select: [stat: keyof Stats] }>()

interface StatMeta { key: keyof Stats; label: string }
const stats: StatMeta[] = [
  { key: 'str', label: 'СИЛ' }, { key: 'dex', label: 'ЛОВ' },
  { key: 'con', label: 'КОН' }, { key: 'int', label: 'ИНТ' },
  { key: 'wis', label: 'МДР' }, { key: 'cha', label: 'ХАР' },
]
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Повысь характеристику</h2>
    <p class="hint">Выбери одну характеристику. Она увеличится на 1.</p>
    <div class="stats-grid">
      <button
        v-for="s in stats"
        :key="s.key"
        class="stat-card"
        @click="$emit('select', s.key)"
      >
        <div class="label">{{ s.label }}</div>
        <div class="stat-card__now">{{ char.stats[s.key] }}</div>
        <div class="stat-card__arrow">↓</div>
        <div class="stat-card__next">{{ char.stats[s.key] + 1 }}</div>
        <div class="stat-card__mod">
          {{ statModifier(char.stats[s.key] + 1) >= 0 ? '+' : '' }}{{ statModifier(char.stats[s.key] + 1) }}
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-card {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 6px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.stat-card:hover { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.stat-card__now { font-size: 18px; color: var(--color-text-muted); }
.stat-card__arrow { font-size: 10px; color: var(--color-text-muted); }
.stat-card__next { font-size: 22px; font-weight: 700; }
.stat-card__mod { font-size: 11px; color: var(--color-text-muted); }
</style>
