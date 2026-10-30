<script setup lang="ts">
import { useTemplateRef } from 'vue'
import IconClose from './icons/IconClose.vue'
import IconSearch from './icons/IconSearch.vue'
import { t } from '@/locales'

defineProps<{
  /** Accessible name of the input. */
  label: string
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')

function clear() {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <label class="search-field">
    <IconSearch class="search-field-icon" aria-hidden="true" />
    <input
      ref="input"
      v-model="model"
      class="search-field-input"
      type="search"
      autocomplete="off"
      :aria-label="label"
      :placeholder="placeholder"
    >
    <button
      v-if="model"
      type="button"
      class="search-field-clear"
      :aria-label="t('ui.searchField.clear')"
      @click="clear"
    >
      <IconClose :size="12" aria-hidden="true" />
    </button>
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
/* The browser's own clear button ignores the palette; the field draws its own. */
.search-field-input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.search-field-clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: -6px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--r-pill);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
}
.search-field-clear:hover { color: var(--vtt-accent); }
.search-field-clear:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 0; }
</style>
