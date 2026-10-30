<script setup lang="ts" generic="T extends string | number | boolean">
import FormField from './FormField.vue'

defineProps<{
  label: string
  options: Array<{ value: T; label: string }>
  error?: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <FormField v-slot="{ id, invalid, describedBy }" :label="label" :error="error">
    <select
      :id="id"
      v-model="model"
      class="form-field-control"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
    >
      <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
    </select>
  </FormField>
</template>
