<script setup lang="ts">
import FormField from './FormField.vue'

withDefaults(defineProps<{
  label: string
  error?: string
  /** Monospace text, for dice formulas and numbers. */
  mono?: boolean
  type?: 'text' | 'email' | 'url' | 'tel'
  inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'url' | 'tel'
  maxlength?: number
  placeholder?: string
  autocomplete?: string
  autocapitalize?: string
}>(), {
  type: 'text',
  autocomplete: 'off',
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <FormField v-slot="{ id, invalid, describedBy }" :label="label" :error="error">
    <input
      :id="id"
      v-model="model"
      :class="['form-field-control', { 'is-mono': mono }]"
      :type="type"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :autocapitalize="autocapitalize"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
    >
  </FormField>
</template>
