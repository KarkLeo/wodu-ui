<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** Number of cells; the code is complete when it has this many characters. */
  length: number
  /** Accessible name of the input; the cells are only drawn. */
  label: string
  id?: string
  disabled?: boolean
  autofocus?: boolean
  /** A wider gap after every this many cells (4 splits an 8-digit code in two). */
  groupSize?: number
  /** Cleans what was typed or pasted; by default keeps the digits, up to `length`. */
  sanitize?: (raw: string) => string
}>(), {
  disabled: false,
  autofocus: false,
})

const emit = defineEmits<{ complete: [code: string] }>()

const model = defineModel<string>({ default: '' })
const input = ref<HTMLInputElement | null>(null)

const cells = computed(() => Array.from({ length: props.length }, (_, i) => model.value[i] ?? ''))

function clean(raw: string): string {
  return props.sanitize ? props.sanitize(raw) : raw.replace(/\D/g, '').slice(0, props.length)
}

function isGroupEnd(i: number): boolean {
  return !!props.groupSize && (i + 1) % props.groupSize === 0 && i < props.length - 1
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const value = clean(el.value)
  el.value = value
  model.value = value
  if (value.length === props.length) emit('complete', value)
}

// A reset from outside (a wrong code, a new code sent) empties the input as well.
watch(model, (value) => {
  if (input.value && input.value.value !== value) input.value.value = value
})

// The attribute alone is honoured once per document, so a second mount in the SPA would not get the focus.
onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="code-field">
    <input
      :id="id"
      ref="input"
      class="cf-input"
      :aria-label="label"
      inputmode="numeric"
      autocomplete="one-time-code"
      :disabled="disabled"
      :autofocus="autofocus"
      @input="onInput"
    >
    <div class="cf-cells" :style="{ gridTemplateColumns: `repeat(${length}, 1fr)` }" aria-hidden="true">
      <span
        v-for="(digit, i) in cells"
        :key="i"
        :class="['cf-cell', { 'is-current': i === model.length, 'is-gap': isGroupEnd(i) }]"
      >{{ digit }}</span>
    </div>
  </div>
</template>

<style scoped>
.code-field { position: relative; }
.cf-input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  font-size: 16px;
  caret-color: transparent;
  border: none;
  background: transparent;
  cursor: text;
}
.cf-cells {
  display: grid;
  gap: 6px;
  pointer-events: none;
}
/* Each tint is preceded by a plain token for browsers without color-mix() (iOS Safari before 16.2). */
.cf-cell {
  min-height: 44px;
  padding: 6px 0 4px;
  text-align: center;
  font-family: var(--font-serif);
  font-size: 24px;
  color: var(--vtt-text-primary);
  border-bottom: 1px solid var(--vtt-border-strong);
  border-bottom: 1px solid color-mix(in srgb, var(--vtt-border-gold) 30%, transparent);
  transition: border-color var(--t-fast) var(--ease);
}
.cf-cell.is-gap { margin-right: 6px; }
.cf-input:focus + .cf-cells .cf-cell.is-current {
  border-bottom-color: var(--vtt-accent);
  box-shadow: 0 6px 10px -8px var(--vtt-accent-deep);
  box-shadow: 0 6px 10px -8px color-mix(in srgb, var(--vtt-accent) 60%, transparent);
}
</style>
