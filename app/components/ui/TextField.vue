<script setup lang="ts">
import FormField from './FormField.vue'

withDefaults(defineProps<{
  label: string
  error?: string
  optional?: string
  hint?: string
  hideLabel?: boolean
  variant?: 'box' | 'underline'
  /** Monospace text, for dice formulas and numbers. */
  mono?: boolean
  type?: 'text' | 'email' | 'url' | 'tel'
  inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'url' | 'tel'
  maxlength?: number
  placeholder?: string
  autocomplete?: string
  autocapitalize?: string
  spellcheck?: boolean
  /** Id of a `<datalist>` with suggestions. */
  list?: string
}>(), {
  type: 'text',
  autocomplete: 'off',
  variant: 'box',
  spellcheck: undefined,
})

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ blur: [event: FocusEvent] }>()
</script>

<template>
  <FormField
    :label="label"
    :error="error"
    :optional="optional"
    :hint="hint"
    :hide-label="hideLabel"
    :variant="variant"
  >
    <template #default="{ id, invalid, describedBy }">
      <input
        :id="id"
        v-model="model"
        :class="['form-field-control', { 'is-mono': mono, 'is-underline': variant === 'underline' }]"
        :type="type"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :autocapitalize="autocapitalize"
        :spellcheck="spellcheck"
        :list="list"
        :aria-invalid="invalid"
        :aria-describedby="describedBy"
        @blur="emit('blur', $event)"
      >
    </template>
    <template v-if="$slots.hint" #hint><slot name="hint" /></template>
  </FormField>
</template>
