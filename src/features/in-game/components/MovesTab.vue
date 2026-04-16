<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, Move } from '@/types/character'
import fighter from '@/data/classes/fighter'

const props = defineProps<{ char: Character }>()

const charMoves = computed((): Move[] =>
  props.char.moveIds
    .map(id => fighter.moves.find(m => m.id === id))
    .filter((m): m is Move => m !== undefined)
)

const expanded = ref<string | null>(charMoves.value[0]?.id ?? null)
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}
</script>

<template>
  <div class="tab-content">
    <div v-if="charMoves.length === 0" class="empty">Нет ходов</div>
    <div v-for="move in charMoves" :key="move.id" class="move-item">
      <button class="move-item__header" @click="toggle(move.id)">
        <span class="move-item__name">{{ move.name }}</span>
        <span class="move-item__chevron">{{ expanded === move.id ? '▲' : '▼' }}</span>
      </button>
      <div v-if="expanded === move.id" class="move-item__desc">
        {{ move.description }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding-bottom: 24px; }
.empty { padding: 24px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.move-item { border-bottom: 1px solid var(--color-border); }
.move-item__header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.move-item__header:hover { background: var(--color-bg-elevated); }
.move-item__chevron { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; }
.move-item__desc { padding: 0 16px 14px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; }
</style>
