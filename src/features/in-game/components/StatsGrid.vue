<script setup lang="ts">
import type { Character, Debilities, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

interface StatMeta {
  key: keyof Stats
  label: string
  debilityKey: keyof Debilities
  debilityName: string
}

const stats: StatMeta[] = [
  { key: 'str', label: 'СИЛ', debilityKey: 'weak',     debilityName: 'Слабый' },
  { key: 'dex', label: 'ЛОВ', debilityKey: 'shaky',    debilityName: 'Нестабильный' },
  { key: 'con', label: 'КОН', debilityKey: 'sick',      debilityName: 'Больной' },
  { key: 'int', label: 'ИНТ', debilityKey: 'stunned',   debilityName: 'Оглушённый' },
  { key: 'wis', label: 'МДР', debilityKey: 'confused',  debilityName: 'Растерянный' },
  { key: 'cha', label: 'ХАР', debilityKey: 'scarred',   debilityName: 'Изуродованный' },
]

function toggleDebility(key: keyof Debilities) {
  emit('patch', {
    debilities: {
      ...props.char.debilities,
      [key]: !props.char.debilities[key],
    },
  })
}

function effectiveMod(statKey: keyof Stats, debKey: keyof Debilities): number {
  const base = statModifier(props.char.stats[statKey])
  return props.char.debilities[debKey] ? base - 1 : base
}
</script>

<template>
  <div class="stats-wrap">
    <div class="label" style="margin-bottom: 8px">Характеристики</div>
    <div class="stats-grid">
      <button
        v-for="s in stats"
        :key="s.key"
        class="stat-card"
        :class="{ 'stat-card--debility': char.debilities[s.debilityKey] }"
        @click="toggleDebility(s.debilityKey)"
      >
        <div class="label">{{ s.label }}</div>
        <div class="stat-card__value">{{ char.stats[s.key] }}</div>
        <div
          class="stat-card__mod"
          :class="{ 'stat-card__mod--reduced': char.debilities[s.debilityKey] }"
        >
          {{ effectiveMod(s.key, s.debilityKey) >= 0 ? '+' : '' }}{{ effectiveMod(s.key, s.debilityKey) }}
        </div>
        <div v-if="char.debilities[s.debilityKey]" class="stat-card__debility-name">
          {{ s.debilityName }}
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stats-wrap { padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.stat-card {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 8px 6px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-card--debility { border-color: var(--color-danger); background: rgba(192,57,43,0.08); }
.stat-card__value { font-size: 22px; font-weight: 700; }
.stat-card__mod { font-size: 12px; color: var(--color-text-muted); }
.stat-card__mod--reduced { color: var(--color-danger); text-decoration: line-through; }
.stat-card__debility-name { font-size: 8px; color: var(--color-danger); text-transform: uppercase; letter-spacing: 0.5px; }
</style>
