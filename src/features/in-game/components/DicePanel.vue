<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useDiceRoller } from '@/composables/useDiceRoller'
import type { RollRecord } from '@/types/dice'
import type { CharacterCommand } from '@/domain/commands'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice')

type Dispatcher = (cmd: CharacterCommand) => void

const props = defineProps<{ dispatch: Dispatcher }>()

const route = useRoute()
const characterId = computed(() => route.params.id as string)
const historyStore = useRollHistoryStore()
const { rollFree, isRolling } = useDiceRoller()

const notation = ref('2d6')
const notationError = ref('')

const records = computed(() => {
  const filtered = historyStore.records.filter(r => r.characterId === characterId.value)
  log.debug('DicePanel filter', {
    routeId: characterId.value,
    total: historyStore.records.length,
    filtered: filtered.length,
    ids: [...new Set(historyStore.records.map(r => r.characterId))],
  })
  return filtered
})

function isValidNotation(n: string): boolean {
  return /^\d+d\d+([+\-]\d+d\d+|[+\-]\d+)*$/.test(n.replace(/\s/g, ''))
}

async function handleRoll() {
  const n = notation.value.trim()
  if (!n) return
  if (!isValidNotation(n)) {
    notationError.value = 'Неверный формат. Пример: 2d6, 1d8+2, 3d6+1d4'
    return
  }
  notationError.value = ''
  try {
    await rollFree(characterId.value, n)
  } catch (err) {
    console.error('Бросок не удался:', err)
  }
}

function onNotationInput() {
  if (notationError.value) notationError.value = ''
}

function applyDamage(record: RollRecord) {
  props.dispatch({ type: 'APPLY_DAMAGE', amount: record.total })
}

function applyHeal(record: RollRecord) {
  props.dispatch({ type: 'HEAL', amount: record.total })
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function entryClass(record: RollRecord): string {
  if (record.purpose.kind === 'stat') return 'entry--stat'
  if (record.purpose.kind === 'damage') return 'entry--damage'
  return 'entry--free'
}

function diceStr(record: RollRecord): string {
  return '[' + record.dice.map(d => d.value).join(', ') + ']'
}
</script>

<template>
  <section class="panel">
    <div class="roller">
      <div class="roller__input-wrap">
        <input
          class="notation-input"
          :class="{ 'notation-input--error': notationError }"
          v-model="notation"
          placeholder="2d6, 1d8+2, 4d6…"
          @keyup.enter="handleRoll"
          @input="onNotationInput"
        />
        <div v-if="notationError" class="notation-error">{{ notationError }}</div>
      </div>
      <button
        class="btn-primary"
        :disabled="isRolling || !notation.trim()"
        @click="handleRoll"
      >
        Бросить
      </button>
    </div>

    <div class="chat">
      <div class="chat__empty" v-if="!records.length">Бросков ещё не было.</div>
      <div
        v-for="r in records"
        :key="r.id"
        class="entry"
        :class="entryClass(r)"
      >
        <div class="entry__header">
          <span class="entry__label">{{ r.label }}</span>
          <span class="entry__time">{{ formatTime(r.timestamp) }}</span>
        </div>
        <div class="entry__body">
          <span class="entry__dice">{{ diceStr(r) }}</span>
          <span v-if="r.modifier !== 0" class="entry__mod">
            {{ r.modifier > 0 ? '+' : '' }}{{ r.modifier }}
          </span>
          <span class="entry__eq"> = </span>
          <span class="entry__total">{{ r.total }}</span>
        </div>
        <div v-if="r.purpose.kind === 'free'" class="entry__actions">
          <button class="btn-action btn-action--dmg" @click="applyDamage(r)">↓ Урон</button>
          <button class="btn-action btn-action--heal" @click="applyHeal(r)">↑ Лечение</button>
        </div>
      </div>
    </div>

    <button
      v-if="records.length"
      class="btn-ghost clear-btn"
      @click="historyStore.clearByCharacter(characterId)"
    >
      Очистить историю
    </button>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
.roller { display: flex; gap: 8px; align-items: flex-start; }
.roller__input-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.notation-input {
  width: 100%;
  padding: 8px 10px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 3px;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}
.notation-input:focus { outline: none; border-color: var(--color-accent); }
.notation-input--error { border-color: #c0392b; }
.notation-error { font-size: 11px; color: #c0392b; }
.chat { display: flex; flex-direction: column; gap: 6px; max-height: 60dvh; overflow-y: auto; }
.chat__empty { color: var(--color-text-muted); font-size: 13px; }
.entry {
  padding: 8px 10px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.entry--stat { border-left-color: var(--color-accent); }
.entry--damage { border-left-color: #c0392b; }
.entry__header { display: flex; justify-content: space-between; align-items: baseline; }
.entry__label { font-size: 12px; font-weight: 600; }
.entry__time { font-size: 11px; color: var(--color-text-muted); }
.entry__body { display: flex; align-items: baseline; gap: 6px; }
.entry__dice { color: var(--color-text-muted); font-size: 13px; font-family: monospace; }
.entry__mod { color: var(--color-text-muted); font-size: 13px; }
.entry__eq { color: var(--color-text-muted); }
.entry__total { font-size: 20px; font-weight: 700; color: var(--color-accent); }
.entry--damage .entry__total { color: #c0392b; }
.entry__actions { display: flex; gap: 6px; margin-top: 2px; }
.btn-action {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: none;
  cursor: pointer;
  font-family: inherit;
  color: var(--color-text-muted);
}
.btn-action--dmg:hover { color: #c0392b; border-color: #c0392b; }
.btn-action--heal:hover { color: var(--color-accent); border-color: var(--color-accent); }
.clear-btn { align-self: flex-start; font-size: 12px; }
</style>
