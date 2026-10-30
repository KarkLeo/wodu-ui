<script setup lang="ts" generic="T extends string | number | boolean">
import FormField from './FormField.vue'
import IconChevronRight from './icons/IconChevronRight.vue'

defineProps<{
  label: string
  options: Array<{ value: T; label: string }>
  error?: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <FormField v-slot="{ id, invalid, describedBy }" :label="label" :error="error">
    <span class="select-field">
      <select
        :id="id"
        v-model="model"
        class="form-field-control select-field-control"
        :aria-invalid="invalid"
        :aria-describedby="describedBy"
      >
        <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      </select>
      <IconChevronRight class="select-field-arrow" aria-hidden="true" />
    </span>
  </FormField>
</template>

<style scoped>
.select-field { position: relative; display: block; min-width: 0; }
/* The native arrow sits against the border and ignores the palette; draw one with room around it. */
.select-field .select-field-control {
  appearance: none;
  padding-right: calc(var(--s-3) * 2 + 12px);
  cursor: pointer;
}
.select-field-arrow {
  position: absolute;
  top: 50%;
  right: var(--s-3);
  width: 12px;
  height: 12px;
  transform: translateY(-50%) rotate(90deg);
  color: var(--vtt-text-muted);
  pointer-events: none;
}
</style>
