<script setup lang="ts">
import type { Character, StatKey } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { STAT_KEYS, STAT_LABELS } from '@/data/xpTable'
import { useDiceRoller } from '@/composables/useDiceRoller'

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ char: Character; dispatch: Dispatcher }>()

const { rollStat, isRolling } = useDiceRoller()

function setStat(key: StatKey, value: number) {
  const v = Math.max(0, Math.min(3, value))
  props.dispatch({ type: 'UPDATE_STATS', stats: { ...props.char.stats, [key]: v } })
}

async function handleRollStat(key: StatKey) {
  try {
    await rollStat(props.char.id, props.char.name, key, STAT_LABELS[key], props.char.stats[key])
  } catch (err) {
    console.error('Бросок характеристики не удался:', err)
  }
}
</script>

<template>
  <section class="panel">
    <div class="label">Характеристики</div>
    <div class="stats">
      <div v-for="key in STAT_KEYS" :key="key" class="stat">
        <div class="stat__label">{{ STAT_LABELS[key] }}</div>
        <input
          type="number"
          class="stat__val"
          min="0"
          max="3"
          :value="char.stats[key]"
          @change="setStat(key, Number(($event.target as HTMLInputElement).value))"
        />
        <button
          class="stat__roll"
          :disabled="isRolling"
          @click="handleRollStat(key)"
        >2d6</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.stat { background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; text-align: center; }
.stat__label { font-size: 11px; color: var(--color-text-muted); }
.stat__val { width: 100%; background: none; border: none; color: var(--color-text); font-family: inherit; font-size: 20px; font-weight: 700; text-align: center; padding: 4px; }
.stat__roll {
  width: 100%;
  background: none;
  border: 1px solid var(--color-border);
  border-top: none;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 10px;
  padding: 3px 0;
  cursor: pointer;
  border-radius: 0 0 3px 3px;
  margin-top: 2px;
}
.stat__roll:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent); }
.stat__roll:disabled { opacity: 0.4; cursor: default; }
</style>
