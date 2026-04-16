<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character, InventoryItem } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  finish: [data: Partial<Character>]
}>()

// Для каждой группы снаряжения — выбранный индекс (null = не выбрано)
// Группа с одним предметом — автовыбор
const selections = ref<(number | null)[]>(
  fighter.startingGear.map(group => group.length === 1 ? 0 : null)
)

const allSelected = computed(() =>
  selections.value.every(s => s !== null)
)

const finalInventory = computed((): InventoryItem[] =>
  selections.value.flatMap((idx, groupIdx) =>
    idx !== null ? [fighter.startingGear[groupIdx][idx]] : []
  )
)

function select(groupIdx: number, itemIdx: number) {
  selections.value[groupIdx] = itemIdx
}

function finish() {
  emit('finish', {
    inventory: finalInventory.value,
    coins: 10,
    armor: finalInventory.value
      .flatMap(i => i.tags)
      .reduce((acc, tag) => {
        const m = tag.match(/^броня (\d+)$/)
        return m ? acc + parseInt(m[1]) : acc
      }, 0),
  })
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Снаряжение</h2>
    <p class="hint">Выбери по одному варианту из каждой группы</p>

    <div class="gear-groups">
      <div
        v-for="(group, gIdx) in fighter.startingGear"
        :key="gIdx"
        class="gear-group"
      >
        <!-- Группа из одного предмета — автовыбрана -->
        <div v-if="group.length === 1" class="gear-auto">
          <span class="label" style="opacity:.5">Автоматически</span>
          <span class="gear-auto__name">{{ group[0].name }}</span>
        </div>
        <!-- Группа с выбором -->
        <div v-else class="choice-list">
          <button
            v-for="(item, iIdx) in group"
            :key="item.id"
            class="choice-item"
            :class="{ 'choice-item--selected': selections[gIdx] === iIdx }"
            @click="select(gIdx, iIdx)"
          >
            <span class="choice-item__name">{{ item.name }}</span>
            <span class="choice-item__hint">вес {{ item.weight }}, {{ item.tags.join(', ') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!allSelected" @click="finish">Создать персонажа →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.gear-groups { display: flex; flex-direction: column; gap: 16px; }
.gear-group {}
.gear-auto { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--border-radius); opacity: 0.7; }
.gear-auto__name { font-size: 14px; }
.choice-list { display: flex; flex-direction: column; gap: 6px; }
.choice-item {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 12px;
  text-align: left;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.choice-item--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.choice-item__name { font-size: 14px; font-weight: 600; }
.choice-item__hint { font-size: 11px; color: var(--color-text-muted); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
