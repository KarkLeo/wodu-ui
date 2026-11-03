<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { t } from '@/locales'

const props = withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  /** `lg` is the full-width amount of a panel: round buttons and a large underlined number. */
  size?: 'lg' | 'md' | 'sm'
  /** Colour of the number. */
  tone?: 'neutral' | 'accent' | 'danger' | 'success'
  ariaLabel?: string
  /** Id of a visible label; takes the place of `ariaLabel`. */
  labelledby?: string
  decreaseLabel?: string
  increaseLabel?: string
  /**
   * Typing edits a draft: the model changes once, on blur, Enter or when the field goes away, and Escape
   * drops the draft. Use it whenever the model writes somewhere (a dispatch writes the whole character).
   */
  lazy?: boolean
  /** Only the number field, where the steps live elsewhere or there are none. */
  hideButtons?: boolean
}>(), {
  step: 1,
  size: 'md',
  tone: 'neutral',
})

const model = defineModel<number>({ required: true })

// A lazy edit in progress. An outside change to the model does not overwrite what is being typed.
const draft = ref<string | null>(null)
const shown = computed(() => draft.value ?? model.value)
const current = computed(() => Number(shown.value) || 0)

const canDec = computed(() => props.min === undefined || current.value > props.min)
const canInc = computed(() => props.max === undefined || current.value < props.max)

function clamp(value: number) {
  let next = value
  if (props.min !== undefined) next = Math.max(next, props.min)
  if (props.max !== undefined) next = Math.min(next, props.max)
  return next
}
function set(value: number) {
  draft.value = null
  const next = clamp(value)
  if (next !== model.value) model.value = next
}
function dec() {
  if (canDec.value) set(current.value - props.step)
}
function inc() {
  if (canInc.value) set(current.value + props.step)
}
function onInput(e: Event) {
  const text = (e.target as HTMLInputElement).value
  if (props.lazy) {
    draft.value = text
    return
  }
  const v = Number(text)
  if (!Number.isNaN(v)) model.value = clamp(v)
}
function commit() {
  if (draft.value === null) return
  const v = Number(draft.value)
  if (Number.isNaN(v)) draft.value = null
  else set(v)
}
function onKeydown(e: KeyboardEvent) {
  if (!props.lazy) return
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    draft.value = null
  }
}
// A popover or sheet closed from outside takes the field away, and a removed input need not fire blur.
onBeforeUnmount(commit)
</script>

<template>
  <div
    :class="['sc-stepper', `sz-${size}`, `tone-${tone}`]"
    :role="hideButtons ? undefined : 'group'"
    :aria-label="hideButtons || labelledby ? undefined : ariaLabel"
    :aria-labelledby="hideButtons ? undefined : labelledby"
  >
    <button
      v-if="!hideButtons"
      type="button"
      :aria-label="decreaseLabel ?? t('ui.stepper.decrease')"
      :disabled="!canDec"
      @click="dec"
    >−</button>
    <input
      :aria-label="labelledby ? undefined : ariaLabel ?? t('ui.stepper.value')"
      :aria-labelledby="labelledby"
      type="number"
      :value="shown"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
      @blur="commit"
      @keydown="onKeydown"
    />
    <button
      v-if="!hideButtons"
      type="button"
      :aria-label="increaseLabel ?? t('ui.stepper.increase')"
      :disabled="!canInc"
      @click="inc"
    >+</button>
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

/* A caller sets --stepper-field-width where an amount needs more room than a stat bonus. */
.sc-stepper input {
  width: var(--stepper-field-width, 42px);
  min-width: 0;
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
.sc-stepper input:focus-visible { border-color: var(--vtt-accent); }

.sz-sm button { width: 18px; height: 18px; font-size: 12px; }
.sz-sm input { width: var(--stepper-field-width, 36px); font-size: 16px; padding: 3px 0; }

.sz-lg {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  gap: 10px;
  width: 100%;
}
.sz-lg button {
  width: 40px;
  height: 40px;
  border-radius: var(--r-pill);
  font-size: 18px;
}
.sz-lg input {
  width: 100%;
  padding: 10px 0;
  font-size: 36px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--vtt-border-subtle);
  border-radius: 0;
  box-shadow: none;
}
.sz-lg input:focus-visible {
  border-bottom-color: var(--vtt-accent);
  box-shadow: 0 1px 0 0 var(--vtt-accent);
}

.tone-accent input { color: var(--vtt-accent); }
.tone-danger input { color: var(--vtt-danger-bright); }
.tone-success input { color: var(--vtt-success); }
</style>
