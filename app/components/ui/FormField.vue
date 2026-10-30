<script setup lang="ts">
import { computed, useId } from 'vue'
import FormError from './FormError.vue'

const props = defineProps<{
  label: string
  error?: string
}>()

const id = useId()
const errorId = `${id}-err`
const describedBy = computed(() => (props.error ? errorId : undefined))
</script>

<template>
  <div class="form-field">
    <label class="form-field-label" :for="id">{{ label }}</label>
    <slot :id="id" :invalid="!!error" :describedBy="describedBy" />
    <FormError v-if="error" :id="errorId">{{ error }}</FormError>
  </div>
</template>

<style scoped>
.form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

/* The control comes from TextField, SelectField or TextareaField. */
:slotted(.form-field-control) {
  width: 100%;
  min-width: 0;
  padding: 9px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  /* 16px keeps iOS Safari from zooming into the field. */
  font-size: 16px;
  outline: none;
}
:slotted(.form-field-control)::placeholder { color: var(--vtt-text-muted); font-style: italic; }
:slotted(.form-field-control:focus) {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
:slotted(.form-field-control[aria-invalid='true']) { border-color: var(--vtt-danger); }
:slotted(.form-field-control.is-mono) { font-family: var(--font-mono); }
:slotted(textarea.form-field-control) { font-family: var(--font-serif); resize: vertical; min-height: 56px; }
</style>
