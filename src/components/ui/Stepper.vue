<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  size?: 'sm' | 'base'
  ariaLabel?: string
}>(), {
  step: 1,
  size: 'base',
})

const model = defineModel<number>({ required: true })

const canDec = computed(() => props.min === undefined || model.value > props.min)
const canInc = computed(() => props.max === undefined || model.value < props.max)

function dec() {
  if (!canDec.value) return
  const next = model.value - props.step
  model.value = props.min !== undefined ? Math.max(next, props.min) : next
}
function inc() {
  if (!canInc.value) return
  const next = model.value + props.step
  model.value = props.max !== undefined ? Math.min(next, props.max) : next
}
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (Number.isNaN(v)) return
  let next = v
  if (props.min !== undefined) next = Math.max(next, props.min)
  if (props.max !== undefined) next = Math.min(next, props.max)
  model.value = next
}
</script>

<template>
  <div :class="['sc-stepper', `sz-${props.size}`]" :aria-label="ariaLabel">
    <button type="button" aria-label="Уменьшить" :disabled="!canDec" @click="dec">−</button>
    <input
      type="number"
      :value="model"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
    />
    <button type="button" aria-label="Увеличить" :disabled="!canInc" @click="inc">+</button>
  </div>
</template>

<style scoped>
.sc-stepper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sc-stepper button {
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  color: var(--vtt-text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}
.sc-stepper button:hover:not(:disabled) {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.sc-stepper button:disabled { opacity: 0.4; cursor: not-allowed; }

.sc-stepper input {
  width: 42px;
  padding: 4px 0;
  text-align: center;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-xs);
  outline: none;
  box-shadow: var(--shadow-inset);
  -moz-appearance: textfield;
}
.sc-stepper input::-webkit-outer-spin-button,
.sc-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.sc-stepper input:focus { border-color: var(--vtt-accent-deep); }

.sz-sm button { width: 18px; height: 18px; font-size: 12px; }
.sz-sm input { width: 36px; font-size: 16px; padding: 3px 0; }
</style>
