<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

// Стандартные наборы чисел DW (распределяешь по 6 характеристикам)
const ARRAYS = [16, 15, 13, 12, 9, 8]

const statKeys: Array<keyof Stats> = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const statNames: Record<keyof Stats, string> = {
  str: 'СИЛ', dex: 'ЛОВ', con: 'КОН', int: 'ИНТ', wis: 'МДР', cha: 'ХАР',
}

// assigned[statKey] = значение из ARRAYS | null
const assigned = ref<Record<keyof Stats, number | null>>({
  str: null, dex: null, con: null, int: null, wis: null, cha: null,
})

const usedValues = computed(() => Object.values(assigned.value).filter(v => v !== null) as number[])
const availableValues = computed(() => ARRAYS.filter(v => !usedValues.value.includes(v)))
const allAssigned = computed(() => usedValues.value.length === 6)

// Выбранный stat для присваивания
const selectedStat = ref<keyof Stats | null>(null)

function selectStat(stat: keyof Stats) {
  selectedStat.value = selectedStat.value === stat ? null : stat
}

function assignValue(val: number) {
  if (!selectedStat.value) return
  assigned.value[selectedStat.value] = val
  selectedStat.value = null
}

function clearStat(stat: keyof Stats) {
  assigned.value[stat] = null
}

function proceed() {
  const stats = Object.fromEntries(
    statKeys.map(k => [k, assigned.value[k] ?? 0])
  ) as Stats
  emit('patch', { stats })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Характеристики</h2>
    <p class="hint">Выбери характеристику → присвой ей значение из списка</p>

    <!-- Статы -->
    <div class="stats-grid">
      <button
        v-for="key in statKeys"
        :key="key"
        class="stat-box"
        :class="{
          'stat-box--selected': selectedStat === key,
          'stat-box--filled': assigned[key] !== null,
        }"
        @click="assigned[key] !== null ? clearStat(key) : selectStat(key)"
      >
        <span class="label">{{ statNames[key] }}</span>
        <span class="stat-box__value">{{ assigned[key] ?? '—' }}</span>
        <span class="stat-box__mod" v-if="assigned[key] !== null">
          {{ statModifier(assigned[key]!) >= 0 ? '+' : '' }}{{ statModifier(assigned[key]!) }}
        </span>
      </button>
    </div>

    <!-- Доступные значения -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">
        {{ selectedStat ? `Присвоить к ${statNames[selectedStat]}:` : 'Доступные значения' }}
      </div>
      <div class="values-row">
        <button
          v-for="val in availableValues"
          :key="val"
          class="value-chip"
          :class="{ 'value-chip--active': selectedStat !== null }"
          @click="assignValue(val)"
        >{{ val }}</button>
        <span v-if="availableValues.length === 0" class="label">Все распределены</span>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!allAssigned" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-box {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 8px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-box--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.stat-box--filled { border-color: var(--color-border); }
.stat-box__value { font-size: 24px; font-weight: 700; }
.stat-box__mod { font-size: 12px; color: var(--color-text-muted); }
.values-row { display: flex; gap: 8px; flex-wrap: wrap; }
.value-chip {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 8px 14px;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: default;
}
.value-chip--active { cursor: pointer; color: var(--color-accent); border-color: var(--color-accent); }
.field { display: flex; flex-direction: column; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
