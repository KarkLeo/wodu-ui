<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { calcMaxHp } from '@/utils/character'
import fighter from '@/data/classes/fighter'
import LevelStatStep from './components/LevelStatStep.vue'
import LevelMoveStep from './components/LevelMoveStep.vue'
import type { Character, Stats } from '@/types/character'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

const step = ref<1 | 2>(1)
const chosenStat = ref<keyof Stats | null>(null)

function selectStat(stat: keyof Stats) {
  chosenStat.value = stat
  step.value = 2
}

function finish(moveId: string) {
  if (!char.value || !chosenStat.value) return
  const newStatVal = char.value.stats[chosenStat.value] + 1
  const newStats = { ...char.value.stats, [chosenStat.value]: newStatVal }

  // Пересчёт maxHp если КОН поднялась выше порога
  const newMaxHp = chosenStat.value === 'con'
    ? calcMaxHp(fighter.baseHp, newStatVal) + (char.value.level) // +1 hp за уровень сверху базы
    : char.value.maxHp

  // Если ход заменяет другой — убрать старый
  const move = fighter.moves.find(m => m.id === moveId)
  let newMoveIds = [...char.value.moveIds]
  if (move?.replacesId) newMoveIds = newMoveIds.filter(id => id !== move.replacesId)
  if (!newMoveIds.includes(moveId)) newMoveIds.push(moveId)

  characters.update(id.value, {
    stats: newStats,
    maxHp: newMaxHp,
    level: char.value.level + 1,
    xp: 0,
    moveIds: newMoveIds,
  })
  router.push(`/character/${id.value}`)
}
</script>

<template>
  <div v-if="char" class="content-wrap">
    <div class="lu-header">
      <button class="btn-ghost" @click="router.push(`/character/${id}`)">← Назад</button>
      <div>
        <div class="label">Повышение уровня</div>
        <div style="font-size: 16px; font-weight: 700;">Уровень {{ char.level }} → {{ char.level + 1 }}</div>
      </div>
      <div class="label" style="text-align: right">Шаг {{ step }}/2</div>
    </div>

    <LevelStatStep
      v-if="step === 1"
      :char="char"
      @select="selectStat"
    />

    <LevelMoveStep
      v-if="step === 2"
      :char="char"
      @finish="finish"
    />
  </div>
</template>

<style scoped>
.lu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
</style>
