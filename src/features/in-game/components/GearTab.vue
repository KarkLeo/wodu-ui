<script setup lang="ts">
import { computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

const currentLoad = computed(() =>
  props.char.inventory.reduce((sum, item) => sum + item.weight, 0)
)

const loadPercent = computed(() =>
  Math.min(100, (currentLoad.value / props.char.maxLoad) * 100)
)

function removeItem(id: string) {
  emit('patch', { inventory: props.char.inventory.filter(i => i.id !== id) })
}

function useItem(id: string) {
  emit('patch', {
    inventory: props.char.inventory.map(item =>
      item.id === id && item.uses !== undefined
        ? { ...item, uses: Math.max(0, item.uses - 1) }
        : item
    ).filter(item => item.uses === undefined || item.uses > 0),
  })
}
</script>

<template>
  <div class="tab-content">
    <!-- Нагрузка -->
    <div class="load-bar-wrap">
      <div class="load-label">
        <span class="label">Нагрузка</span>
        <span class="label">{{ currentLoad }} / {{ char.maxLoad }}</span>
      </div>
      <div class="load-bar">
        <div
          class="load-bar__fill"
          :style="{ width: loadPercent + '%' }"
          :class="{ 'load-bar__fill--over': currentLoad > char.maxLoad }"
        />
      </div>
    </div>

    <!-- Список предметов -->
    <div v-if="char.inventory.length === 0" class="empty">Снаряжение отсутствует</div>
    <div v-for="item in char.inventory" :key="item.id" class="item-row">
      <div class="item-info">
        <div class="item-name">{{ item.name }}</div>
        <div class="label">вес {{ item.weight }}{{ item.uses !== undefined ? ` · осталось ${item.uses}` : '' }}</div>
      </div>
      <div class="item-actions">
        <button v-if="item.uses !== undefined" class="action-btn" @click="useItem(item.id)">Использовать</button>
        <button class="action-btn action-btn--danger" @click="removeItem(item.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding-bottom: 24px; }
.load-bar-wrap { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.load-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
.load-bar { height: 5px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.load-bar__fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.load-bar__fill--over { background: var(--color-danger); }
.empty { padding: 24px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
.item-name { font-size: 14px; margin-bottom: 2px; }
.item-actions { display: flex; gap: 8px; }
.action-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.action-btn--danger { color: var(--color-danger); border-color: var(--color-danger); }
</style>
