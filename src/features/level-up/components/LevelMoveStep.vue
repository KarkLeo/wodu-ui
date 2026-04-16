<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, Move } from '@/types/character'
import fighter from '@/data/classes/fighter'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ finish: [moveId: string] }>()

const moveType = computed(() =>
  props.char.level < 6 ? 'advanced_2_5' : 'advanced_6_10'
)

const availableMoves = computed((): Move[] =>
  fighter.moves.filter(m => {
    if (m.type !== moveType.value) return false
    if (props.char.moveIds.includes(m.id)) return false // уже взят
    return true
  })
)

function isLocked(move: Move): boolean {
  if (!move.requiresId) return false
  return !props.char.moveIds.includes(move.requiresId)
}

const expanded = ref<string | null>(null)
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Выбери новый ход</h2>
    <p class="hint">Ходы с серым фоном недоступны — не выполнено условие.</p>

    <div class="moves-list">
      <div
        v-for="move in availableMoves"
        :key="move.id"
        class="move-item"
        :class="{ 'move-item--locked': isLocked(move) }"
      >
        <div class="move-item__header" @click="expanded = expanded === move.id ? null : move.id">
          <div>
            <div class="move-item__name">{{ move.name }}</div>
            <div v-if="move.replacesId" class="move-item__replaces label">
              Заменяет: {{ fighter.moves.find(m => m.id === move.replacesId)?.name }}
            </div>
            <div v-if="isLocked(move)" class="move-item__locked-msg label">
              Требует: {{ fighter.moves.find(m => m.id === move.requiresId)?.name }}
            </div>
          </div>
          <span class="move-item__chevron">{{ expanded === move.id ? '▲' : '▼' }}</span>
        </div>
        <div v-if="expanded === move.id" class="move-item__desc">
          {{ move.description }}
        </div>
        <div v-if="!isLocked(move)" class="move-item__footer">
          <button class="btn-primary" @click="$emit('finish', move.id)">Выбрать этот ход</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.moves-list { display: flex; flex-direction: column; gap: 8px; }
.move-item { border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; }
.move-item--locked { opacity: 0.45; }
.move-item__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  cursor: pointer;
  background: var(--color-bg-elevated);
}
.move-item__name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.move-item__replaces { color: var(--color-text-muted); }
.move-item__locked-msg { color: var(--color-danger); }
.move-item__chevron { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; margin-left: 8px; }
.move-item__desc { padding: 0 12px 12px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; }
.move-item__footer { padding: 0 12px 12px; }
</style>
