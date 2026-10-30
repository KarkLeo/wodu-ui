<script setup lang="ts">
import FormField from './FormField.vue'

withDefaults(defineProps<{
  label: string
  error?: string
  rows?: number
  maxlength?: number
  placeholder?: string
}>(), {
  rows: 3,
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <FormField v-slot="{ id, invalid, describedBy }" :label="label" :error="error">
    <textarea
      :id="id"
      v-model="model"
      class="form-field-control"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
    />
  </FormField>
</template>
