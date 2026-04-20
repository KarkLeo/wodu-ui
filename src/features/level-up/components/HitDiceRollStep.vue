<script setup lang="ts">
import { ref, computed } from 'vue'
import { rollD6 } from '@/utils/derived'

const props = defineProps<{ numDice: number; targetLevel: number }>()
const emit = defineEmits<{ done: [newMaxHp: number] }>()

const rolls = ref<number[]>([])

function doRoll() {
  rolls.value = Array.from({ length: props.numDice }, () => rollD6())
    .sort((a, b) => b - a)
}

const kept = computed(() => rolls.value.slice(0, props.targetLevel))
const total = computed(() => kept.value.reduce((a, b) => a + b, 0))
</script>

<template>
  <section class="step">
    <div class="label">Бросок hit dice</div>
    <p class="hint">{{ numDice }}к6 — оставить лучшие {{ targetLevel }}</p>

    <div v-if="rolls.length" class="dice-row">
      <span
        v-for="(val, i) in rolls"
        :key="i"
        class="die"
        :class="i < targetLevel ? 'die--kept' : 'die--dropped'"
      >{{ val }}</span>
    </div>

    <div v-if="rolls.length" class="result">
      Прирост ОЗ: <b>{{ total }}</b>
    </div>

    <div class="actions">
      <button class="btn-primary" @click="doRoll">
        {{ rolls.length ? 'Перебросить' : 'Бросить' }}
      </button>
      <button
        class="btn-primary"
        :disabled="!rolls.length"
        @click="emit('done', total)"
      >
        Принять
      </button>
    </div>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.hint { margin: 0; font-size: 12px; color: var(--color-text-muted); }
.dice-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.die { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; border-radius: 4px; border: 2px solid transparent; }
.die--kept { border-color: var(--color-accent); color: var(--color-accent); }
.die--dropped { opacity: 0.35; }
.result { font-size: 16px; text-align: center; }
.actions { display: flex; gap: 8px; }
</style>
