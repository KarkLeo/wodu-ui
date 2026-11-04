<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'
import FormError from './FormError.vue'

const props = withDefaults(defineProps<{
  label: string
  error?: string
  /** Muted note after the label, e.g. "optional". It is part of the accessible name. */
  optional?: string
  /** Help under the control; the `hint` slot replaces the text, e.g. to add an icon. */
  hint?: string
  /** Keeps the label for assistive tech only, where the context already says what the field is. */
  hideLabel?: boolean
  /** `underline`: transparent control with a bottom rule and a larger serif text, as on the sign-in screens. */
  variant?: 'box' | 'underline'
}>(), {
  variant: 'box',
})

const slots = useSlots()
const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-err`
const hasHint = computed(() => !!props.hint || !!slots.hint)
const describedBy = computed(() => {
  const ids = [hasHint.value && hintId, props.error && errorId].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div :class="['form-field', { 'is-underline': variant === 'underline' }]">
    <label :class="['form-field-label', { 'is-hidden': hideLabel }]" :for="id">
      {{ label }} <span v-if="optional" class="form-field-optional">{{ optional }}</span>
    </label>
    <slot :id="id" :invalid="!!error" :describedBy="describedBy" />
    <span v-if="hasHint" :id="hintId" class="form-field-hint"><slot name="hint">{{ hint }}</slot></span>
    <FormError v-if="error" :id="errorId">{{ error }}</FormError>
  </div>
</template>

<style scoped>
.form-field { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-field.is-underline { gap: 2px; }
.form-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.is-underline .form-field-label { letter-spacing: 0.22em; color: var(--vtt-accent-deep); }
.form-field-label.is-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.form-field-optional {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--vtt-text-muted);
}
.form-field-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
.is-underline .form-field-hint { margin-top: 6px; }

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
  box-shadow: 0 0 0 2px var(--vtt-gold-a15);
}
:slotted(.form-field-control[aria-invalid='true']) { border-color: var(--vtt-danger); }
:slotted(.form-field-control.is-mono) { font-family: var(--font-mono); }
:slotted(.form-field-control.is-sm) { padding: 6px 10px; line-height: 1.25; }
:slotted(.form-field-control.is-sm)::placeholder { font-size: 13px; }
:slotted(textarea.form-field-control) { font-family: var(--font-serif); resize: vertical; min-height: 56px; }
:slotted(.form-field-control.is-underline) {
  padding: 8px 4px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--vtt-gold-a30);
  border-radius: 0;
  font-family: var(--font-serif);
  font-size: 18px;
  transition: border-color var(--t-fast) var(--ease);
}
:slotted(.form-field-control.is-underline:focus) { border-bottom-color: var(--vtt-accent); box-shadow: none; }
:slotted(.form-field-control.is-underline[aria-invalid='true']) { border-bottom-color: var(--vtt-danger); }
</style>
