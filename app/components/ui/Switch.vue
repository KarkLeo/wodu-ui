<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  /** The accessible name; also the visible text unless the default slot or `hideLabel` replaces it. */
  label: string
  disabled?: boolean
  /** A change is being saved: announced, while the switch stays usable and keeps its focus. */
  busy?: boolean
  hideLabel?: boolean
}>()

const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label :class="['switch', { 'is-disabled': disabled }]">
    <SwitchRoot v-model="model" class="switch-root" :disabled="disabled" :aria-label="label" :aria-busy="busy || undefined">
      <SwitchThumb class="switch-thumb" />
    </SwitchRoot>
    <span v-if="$slots.default" class="switch-label"><slot /></span>
    <span v-else-if="!hideLabel" class="switch-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  color: var(--vtt-text-secondary);
  font-size: 13px;
}
.switch.is-disabled { opacity: 0.5; cursor: not-allowed; }
.switch-root {
  position: relative;
  flex-shrink: 0;
  width: 34px;
  height: 20px;
  padding: 0;
  background: var(--vtt-bg-sunken);
  border: 1.5px solid var(--vtt-border-strong);
  border-radius: var(--r-pill);
  cursor: inherit;
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
.switch-root:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 2px; }
.switch-root[data-state='checked'] { background: var(--vtt-accent); border-color: var(--vtt-accent); }
.switch-thumb {
  display: block;
  width: 13px;
  height: 13px;
  margin-left: 2px;
  background: var(--vtt-text-secondary);
  border-radius: var(--r-pill);
  transition: transform var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.switch-thumb[data-state='checked'] { transform: translateX(14px); background: var(--vtt-bg-base); }
</style>
