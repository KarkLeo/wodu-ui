<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character, Move } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

const REQUIRED_COUNT = 1 // Fighter выбирает 1 стартовый ход (плюс Фирменное оружие и В доспехах — автоматически)

// Auto-granted to all Fighters; excluded from manual selection
const AUTO_GRANTED = ['fighter_signature_weapon', 'fighter_armored']

// Ходы, доступные для выбора в мастере (стартовые, не расовые, не даются автоматически)
const selectableMoves = computed(() =>
  fighter.moves.filter(m =>
    m.type === 'starting' &&
    !m.id.startsWith('fighter_race_') &&
    !AUTO_GRANTED.includes(m.id)
  )
)

const selected = ref<string[]>([...props.draft.startingMoveIds])

function toggle(move: Move) {
  const idx = selected.value.indexOf(move.id)
  if (idx !== -1) {
    selected.value.splice(idx, 1)
  } else if (selected.value.length < REQUIRED_COUNT) {
    selected.value.push(move.id)
  }
}

const expanded = ref<string | null>(null)
function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

const canProceed = computed(() => selected.value.length === REQUIRED_COUNT)

function proceed() {
  emit('patch', { startingMoveIds: [...selected.value] })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Стартовые ходы</h2>
    <p class="hint">Выбери {{ REQUIRED_COUNT }} из {{ selectableMoves.length }} ходов ({{ selected.length }}/{{ REQUIRED_COUNT }})</p>
    <p class="hint" style="margin-top: -12px">«Фирменное оружие» и «В доспехах» даются автоматически</p>

    <div class="moves-list">
      <div
        v-for="move in selectableMoves"
        :key="move.id"
        class="move-item"
        :class="{
          'move-item--selected': selected.includes(move.id),
          'move-item--disabled': !selected.includes(move.id) && selected.length >= REQUIRED_COUNT,
        }"
      >
        <div class="move-item__header" @click="toggle(move)">
          <div class="move-item__check">
            <span v-if="selected.includes(move.id)">✓</span>
          </div>
          <span class="move-item__name">{{ move.name }}</span>
          <button class="move-item__expand" @click.stop="toggleExpand(move.id)">
            {{ expanded === move.id ? '▲' : '▼' }}
          </button>
        </div>
        <div v-if="expanded === move.id" class="move-item__desc">
          {{ move.description }}
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canProceed" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.moves-list { display: flex; flex-direction: column; gap: 6px; }
.move-item { border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; }
.move-item--selected { border-color: var(--color-accent); }
.move-item--disabled { opacity: 0.4; }
.move-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--color-bg-elevated);
}
.move-item--selected .move-item__header { background: var(--color-bg-elevated); }
.move-item__check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-accent);
  flex-shrink: 0;
}
.move-item--selected .move-item__check { border-color: var(--color-accent); }
.move-item__name { flex: 1; font-size: 14px; font-weight: 600; }
.move-item__expand { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 10px; }
.move-item__desc { padding: 10px 12px; font-size: 12px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--color-border); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
