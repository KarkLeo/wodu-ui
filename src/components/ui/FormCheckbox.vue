<script setup lang="ts">
import IconCheckBold from './icons/IconCheckBold.vue'

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label :class="['form-check', { 'is-checked': model }]">
    <input
      type="checkbox"
      class="form-check-input"
      :checked="model"
      @change="model = ($event.target as HTMLInputElement).checked"
    />
    <span class="form-check-box">
      <IconCheckBold />
    </span>
    <span class="form-check-label"><slot /></span>
  </label>
</template>

<style scoped>
.form-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  color: var(--vtt-text-secondary);
  font-size: 13px;
}
.form-check-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.form-check-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--vtt-border-strong);
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--t-fast) var(--ease);
}
.form-check-box :deep(svg) {
  width: 12px;
  height: 12px;
  color: var(--vtt-bg-base);
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease);
}
.form-check.is-checked .form-check-box {
  background: var(--vtt-accent);
  border-color: var(--vtt-accent);
}
.form-check.is-checked .form-check-box :deep(svg) { opacity: 1; }
</style>
