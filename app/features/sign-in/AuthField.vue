<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  id: string
  label: string
  optional?: string
  hint?: string
  type?: 'text' | 'email'
  placeholder?: string
  autocomplete?: string
  maxlength?: number
}>(), {
  type: 'text',
})

const model = defineModel<string>({ required: true })
const input = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="af-field">
    <label class="af-label" :for="id">
      {{ label }}<span v-if="optional" class="af-opt">{{ optional }}</span>
    </label>
    <input
      :id="id"
      ref="input"
      v-model="model"
      class="af-input"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :maxlength="maxlength"
      spellcheck="false"
    >
    <span v-if="hint" class="af-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.af-field { display: flex; flex-direction: column; gap: 2px; }
.af-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.af-opt {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--vtt-text-muted);
}
.af-input {
  font-family: var(--font-serif);
  font-size: 18px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(140, 106, 58, 0.3);
  color: var(--vtt-text-primary);
  outline: none;
  transition: border-color var(--t-fast) var(--ease);
  min-width: 0;
}
.af-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }
.af-input:focus { border-bottom-color: var(--vtt-accent); }
.af-hint {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  color: var(--vtt-text-muted);
  margin-top: 6px;
  line-height: 1.45;
}
</style>
