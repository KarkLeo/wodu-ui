<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import StepIdentity from './steps/StepIdentity.vue'
import StepTraining from './steps/StepTraining.vue'
import StepGear from './steps/StepGear.vue'
import type { Character } from '@/types/character'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

onMounted(() => {
  if (!creation.draftId) {
    const draft = characters.add({
      status: 'draft',
      classId: 'fighter',
      name: '',
      level: 1,
      xp: 0,
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      statRolls: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      hitDice: 1,
      currentHp: 0,
      maxHp: 0,
      skillIds: [],
      abilityIds: [],
      inventory: [],
      coins: 60,
      damageBonusDice: 0,
      notes: '',
    })
    creation.setDraft(draft.id)
  }
})

const draft = computed(() => (creation.draftId ? characters.getById(creation.draftId) : undefined))

const stepComponents = [StepIdentity, StepTraining, StepGear]
const currentStepComponent = computed(() => stepComponents[creation.step - 1])

function patch(data: Partial<Character>) {
  if (creation.draftId) characters.update(creation.draftId, data)
}

function next() {
  creation.nextStep()
}

function back() {
  if (creation.step === 1) {
    if (creation.draftId) characters.remove(creation.draftId)
    creation.reset()
    router.push('/')
  } else {
    creation.prevStep()
  }
}

function finish() {
  if (!creation.draftId) return
  characters.update(creation.draftId, { status: 'active' })
  characters.setActive(creation.draftId)
  const id = creation.draftId
  creation.reset()
  router.push(`/character/${id}`)
}
</script>

<template>
  <div class="content-wrap" v-if="draft">
    <div class="progress-bar">
      <div
        v-for="n in 3"
        :key="n"
        class="progress-bar__segment"
        :class="{ 'progress-bar__segment--done': n <= creation.step }"
      />
    </div>
    <div class="creation-header">
      <button class="btn-ghost" @click="back">← Назад</button>
      <span class="label">Шаг {{ creation.step }} из 3</span>
    </div>
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
.progress-bar { display: flex; height: 3px; background: var(--color-bg-dark); }
.progress-bar__segment { flex: 1; background: var(--color-border); opacity: 0.3; transition: opacity 0.2s; }
.progress-bar__segment--done { opacity: 1; }
.creation-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--color-border); }
</style>
