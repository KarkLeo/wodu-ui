<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useCreationStore } from '@/stores/creation'
import StepIdentity from './steps/StepIdentity.vue'
import StepTraining from './steps/StepTraining.vue'
import StepGear from './steps/StepGear.vue'

const router = useRouter()
const creation = useCreationStore()
const { draft, step, patch, dispatch, next, back, finish } = useCharacterCreation()

const stepComponents = [StepIdentity, StepTraining, StepGear]
const currentStepComponent = computed(() => stepComponents[step.value - 1])

onMounted(() => {
  // Если черновика нет — кто-то зашёл на /character/new напрямую
  if (!creation.draftId) {
    router.push('/')
  }
})
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
      :dispatch="dispatch"
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
