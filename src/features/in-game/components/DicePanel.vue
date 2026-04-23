<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { useCharactersStore } from '@/stores/characters'
import { useDiceRoller } from '@/composables/useDiceRoller'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

type Tab = 'all' | 'rolls' | 'changes'
type FeedItem =
  | { kind: 'roll'; id: string; timestamp: number; payload: RollRecord }
  | { kind: 'change'; id: string; timestamp: number; payload: ChangeEntry }

const route = useRoute()
const historyStore = useRollHistoryStore()
const changeLogStore = useChangeLogStore()
const charactersStore = useCharactersStore()
const { rollFree, isRolling } = useDiceRoller()

const notation = ref('2d6')
const notationError = ref('')
const tab = ref<Tab>('all')

const feed = computed<FeedItem[]>(() => {
  const rolls: FeedItem[] = historyStore.records.map(r => ({
    kind: 'roll', id: r.id, timestamp: r.timestamp, payload: r,
  }))
  const changes: FeedItem[] = changeLogStore.entries.map(e => ({
    kind: 'change', id: e.id, timestamp: e.timestamp, payload: e,
  }))
  const merged = [...rolls, ...changes].sort((a, b) => b.timestamp - a.timestamp)
  if (tab.value === 'rolls') return merged.filter(i => i.kind === 'roll')
  if (tab.value === 'changes') return merged.filter(i => i.kind === 'change')
  return merged
})

const activeChar = computed(() => {
  const id = route.params.id
  if (typeof id !== 'string') return undefined
  return charactersStore.list.find(c => c.id === id)
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
  if (!activeChar.value) return
  notationError.value = ''
  try {
    await rollFree(activeChar.value.id, activeChar.value.name, n)
  } catch (err) {
    console.error('Бросок не удался:', err)
  }
}

function onNotationInput() {
  if (notationError.value) notationError.value = ''
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function rollClass(record: RollRecord): string {
  if (record.purpose.kind === 'stat') return 'entry--stat'
  if (record.purpose.kind === 'damage') return 'entry--damage'
  return 'entry--free'
}

function changeClass(entry: ChangeEntry): string {
  switch (entry.kind) {
    case 'hp-damage': return 'entry--change entry--damage'
    case 'hp-heal': return 'entry--change entry--heal'
    case 'xp-gain':
    case 'level-up': return 'entry--change entry--progress'
    case 'stats': return 'entry--change entry--stats'
    case 'equip':
    case 'unequip': return 'entry--change entry--equip'
    default: return 'entry--change'
  }
}

function diceStr(record: RollRecord): string {
  return '[' + record.dice.map(d => d.value).join(', ') + ']'
}

function authorNameForRoll(record: RollRecord): string {
  if (record.characterName) return record.characterName
  const live = charactersStore.list.find(c => c.id === record.characterId)
  return live?.name ?? '—'
}

function authorNameForChange(entry: ChangeEntry): string {
  if (entry.characterName) return entry.characterName
  const live = charactersStore.list.find(c => c.id === entry.characterId)
  return live?.name ?? '—'
}

function clearAll() {
  historyStore.clearAll()
  changeLogStore.clearAll()
}

const hasAny = computed(() => feed.value.length > 0)
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
          :disabled="!activeChar"
          @keyup.enter="handleRoll"
          @input="onNotationInput"
        />
        <div v-if="notationError" class="notation-error">{{ notationError }}</div>
        <div v-else-if="!activeChar" class="notation-hint">Откройте лист персонажа, чтобы бросать.</div>
      </div>
      <button
        class="btn-primary"
        :disabled="isRolling || !notation.trim() || !activeChar"
        @click="handleRoll"
      >
        Бросить
      </button>
    </div>

    <div class="tabs" role="tablist">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': tab === 'all' }"
        @click="tab = 'all'"
      >Всё</button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': tab === 'rolls' }"
        @click="tab = 'rolls'"
      >Броски</button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': tab === 'changes' }"
        @click="tab = 'changes'"
      >Изменения</button>
    </div>

    <div class="chat">
      <div class="chat__empty" v-if="!feed.length">Записей ещё нет.</div>
      <template v-for="item in feed" :key="item.id">
        <div
          v-if="item.kind === 'roll'"
          class="entry"
          :class="rollClass(item.payload)"
        >
          <div class="entry__header">
            <span class="entry__author">{{ authorNameForRoll(item.payload) }}</span>
            <span class="entry__time">{{ formatTime(item.payload.timestamp) }}</span>
          </div>
          <div class="entry__label">{{ item.payload.label }}</div>
          <div class="entry__body">
            <span class="entry__dice">{{ diceStr(item.payload) }}</span>
            <span v-if="item.payload.modifier !== 0" class="entry__mod">
              {{ item.payload.modifier > 0 ? '+' : '' }}{{ item.payload.modifier }}
            </span>
            <span class="entry__eq"> = </span>
            <span class="entry__total">{{ item.payload.total }}</span>
          </div>
        </div>
        <div
          v-else
          class="entry"
          :class="changeClass(item.payload)"
        >
          <div class="entry__header">
            <span class="entry__author">{{ authorNameForChange(item.payload) }}</span>
            <span class="entry__time">{{ formatTime(item.payload.timestamp) }}</span>
          </div>
          <div class="entry__change-row">
            <span class="entry__label entry__label--change">{{ item.payload.label }}</span>
            <span v-if="item.payload.delta" class="entry__delta">{{ item.payload.delta }}</span>
          </div>
        </div>
      </template>
    </div>

    <button
      v-if="hasAny"
      class="btn-ghost clear-btn"
      @click="clearAll"
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
.notation-hint { font-size: 11px; color: var(--color-text-muted); }

.tabs {
  display: flex;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 2px;
  background: var(--color-bg-elevated);
}
.tab-btn {
  flex: 1;
  padding: 6px 8px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  border-radius: 2px;
}
.tab-btn:hover { color: var(--color-text); }
.tab-btn--active {
  background: var(--color-bg);
  color: var(--color-accent);
}

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
.entry--heal { border-left-color: #2ecc71; }
.entry--progress { border-left-color: #f1c40f; }
.entry--stats { border-left-color: #9b59b6; }
.entry--equip { border-left-color: #7f8c8d; }
.entry__header { display: flex; justify-content: space-between; align-items: baseline; }
.entry__author { font-size: 11px; font-weight: 600; color: var(--color-accent); letter-spacing: 0.02em; }
.entry__time { font-size: 11px; color: var(--color-text-muted); }
.entry__label { font-size: 12px; font-weight: 600; }
.entry__label--change { font-weight: 500; }
.entry__body { display: flex; align-items: baseline; gap: 6px; }
.entry__dice { color: var(--color-text-muted); font-size: 13px; font-family: monospace; }
.entry__mod { color: var(--color-text-muted); font-size: 13px; }
.entry__eq { color: var(--color-text-muted); }
.entry__total { font-size: 20px; font-weight: 700; color: var(--color-accent); }
.entry--damage .entry__total { color: #c0392b; }
.entry__change-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry__delta {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent);
  font-family: monospace;
  white-space: nowrap;
}
.entry--damage .entry__delta { color: #c0392b; }
.entry--heal .entry__delta { color: #2ecc71; }
.clear-btn { align-self: flex-start; font-size: 12px; }
</style>
