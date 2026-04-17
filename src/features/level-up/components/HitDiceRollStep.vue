<script setup lang="ts">
import { ref } from 'vue'
import { rollD6 } from '@/utils/derived'

const emit = defineEmits<{ done: [hpDelta: number] }>()
const roll = ref<number | null>(null)

function doRoll() {
  roll.value = rollD6()
}
function confirm() {
  if (roll.value !== null) emit('done', roll.value)
}
</script>

<template>
  <section class="step">
    <div class="label">Бросок нового hit die (d6)</div>
    <div class="roll">
      <span class="roll__val">{{ roll ?? '—' }}</span>
      <button class="btn-primary" @click="doRoll">{{ roll === null ? 'Бросить' : 'Перебросить' }}</button>
    </div>
    <button class="btn-primary" :disabled="roll === null" @click="confirm">Принять (+{{ roll ?? 0 }} HP)</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.roll { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.roll__val { font-size: 32px; font-weight: 700; flex: 1; text-align: center; }
</style>
