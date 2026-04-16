<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { calcMaxHp, calcMaxLoad } from '@/utils/character'
import fighter from '@/data/classes/fighter'
import StepIdentity from './steps/StepIdentity.vue'
import StepStats from './steps/StepStats.vue'
import StepMoves from './steps/StepMoves.vue'
import StepGear from './steps/StepGear.vue'
import type { Character, Stats } from '@/types/character'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

// Если есть draftId — загружаем существующий черновик, иначе создаём новый
onMounted(() => {
  if (!creation.draftId) {
    const draft = characters.add({
      status: 'draft',
      classId: 'fighter',
      name: '',
      look: '',
      alignment: '',
      race: '',
      bonds: [...fighter.bondTemplates],
      startingMoveIds: [],
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      currentHp: 0,
      maxHp: 0,
      armor: 0,
      xp: 0,
      level: 1,
      damageDice: fighter.damageDice,
      debilities: { weak: false, shaky: false, sick: false, stunned: false, confused: false, scarred: false },
      moveIds: [],
      inventory: [],
      coins: 0,
      maxLoad: 0,
    })
    creation.setDraft(draft.id)
  }
})

const draft = computed(() => characters.getById(creation.draftId ?? ''))

const stepComponents = [StepIdentity, StepStats, StepMoves, StepGear]
const currentStepComponent = computed(() => stepComponents[creation.step - 1])

function patch(data: Partial<Character>) {
  if (creation.draftId) characters.update(creation.draftId, data)
}

function next() {
  creation.nextStep()
}

function back() {
  if (creation.step === 1) {
    // Удалить черновик и вернуться на главную
    if (creation.draftId) characters.remove(creation.draftId)
    creation.reset()
    router.push('/')
  } else {
    creation.prevStep()
  }
}

function finish(gearPatch: Partial<Character>) {
  if (!creation.draftId || !draft.value) return
  const d = draft.value
  const maxHp = calcMaxHp(fighter.baseHp, d.stats.con)
  const maxLoad = calcMaxLoad(fighter.baseLoad, d.stats.str)
  // Стартовые ходы + расовый ход + ходы, даваемые автоматически
  const AUTO_GRANTED = ['fighter_signature_weapon', 'fighter_armored']
  const raceMove = fighter.races.find(r => r.id === d.race)
  const allMoveIds = [...d.startingMoveIds]
  for (const id of AUTO_GRANTED) {
    if (!allMoveIds.includes(id)) allMoveIds.push(id)
  }
  if (raceMove && !allMoveIds.includes(raceMove.moveId)) allMoveIds.push(raceMove.moveId)

  characters.update(creation.draftId, {
    ...gearPatch,
    maxHp,
    currentHp: maxHp,
    maxLoad,
    moveIds: allMoveIds,
    status: 'active',
  })
  const id = creation.draftId
  creation.reset()
  router.push(`/character/${id}`)
}
</script>

<template>
  <div class="content-wrap" v-if="draft">
    <!-- Прогресс-бар -->
    <div class="progress-bar">
      <div
        v-for="n in 4"
        :key="n"
        class="progress-bar__segment"
        :class="{ 'progress-bar__segment--done': n <= creation.step }"
      />
    </div>

    <!-- Шапка -->
    <div class="creation-header">
      <button class="btn-ghost" @click="back">← Назад</button>
      <span class="label">Шаг {{ creation.step }} из 4</span>
    </div>

    <!-- Текущий шаг -->
    <component
      :is="currentStepComponent"
      :draft="draft"
      @patch="patch"
      @next="next"
      @finish="finish"
    />
  </div>
</template>

<style scoped>
.progress-bar {
  display: flex;
  height: 3px;
  background: var(--color-bg-dark);
}
.progress-bar__segment {
  flex: 1;
  background: var(--color-border);
  opacity: 0.3;
  transition: opacity 0.2s;
}
.progress-bar__segment--done { opacity: 1; }
.creation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
}
</style>
