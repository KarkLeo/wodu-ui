<script setup lang="ts">
import IconSearch from './icons/IconSearch.vue'

defineProps<{
  /** Accessible name of the input. */
  label: string
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <label class="search-field">
    <IconSearch class="search-field-icon" aria-hidden="true" />
    <input
      v-model="model"
      class="search-field-input"
      type="search"
      autocomplete="off"
      :aria-label="label"
      :placeholder="placeholder"
    >
  </label>
</template>

<style scoped>
.search-field {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  transition: border-color var(--t-fast) var(--ease);
}
.search-field:focus-within { border-color: var(--vtt-border-gold); }
.search-field-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--vtt-text-muted); }
.search-field-input {
  flex: 1;
  min-width: 0;
  padding: 8px 0;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  /* 16px keeps iOS Safari from zooming into the field. */
  font-size: 16px;
}
.search-field-input::placeholder { color: var(--vtt-text-muted); font-style: italic; }
</style>
