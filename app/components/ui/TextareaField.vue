<script setup lang="ts">
import FormField from './FormField.vue'

withDefaults(defineProps<{
  label: string
  error?: string
  optional?: string
  hint?: string
  hideLabel?: boolean
  rows?: number
  maxlength?: number
  placeholder?: string
}>(), {
  rows: 3,
})

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ blur: [event: FocusEvent] }>()
</script>

<template>
  <FormField
    v-slot="{ id, invalid, describedBy }"
    :label="label"
    :error="error"
    :optional="optional"
    :hint="hint"
    :hide-label="hideLabel"
  >
    <textarea
      :id="id"
      v-model="model"
      class="form-field-control"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      @blur="emit('blur', $event)"
    />
  </FormField>
</template>
