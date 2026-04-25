<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value?: string
  placeholder?: string
}>()

const presetClass = computed(() => {
  if (!props.value) return ''
  const map: Record<string, string> = {
    'Огонь': 'sphere-fire',
    'Тень': 'sphere-shadow',
    'Камень': 'sphere-stone',
    'Молния': 'sphere-storm',
    'Тайны': 'sphere-secret',
    'Страх': 'sphere-fear',
  }
  return map[props.value] ?? 'sphere-custom'
})

const isEmpty = computed(() => !props.value)
const label = computed(() => props.value || props.placeholder || 'Сфера')
</script>

<template>
  <span :class="['sphere-chip', presetClass, { 'is-empty': isEmpty }]">
    <span class="sphere-chip-dot" />
    {{ label }}
  </span>
</template>

<style scoped>
.sphere-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 6px;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
  background: var(--vtt-bg-elevated);
  white-space: nowrap;
  flex-shrink: 0;
}
.sphere-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--vtt-text-muted);
  flex-shrink: 0;
}
.sphere-chip.sphere-fire .sphere-chip-dot { background: #C04A2B; }
.sphere-chip.sphere-shadow .sphere-chip-dot { background: #5A4A6E; }
.sphere-chip.sphere-stone .sphere-chip-dot { background: #7A6A4E; }
.sphere-chip.sphere-storm .sphere-chip-dot { background: #8EA8B8; }
.sphere-chip.sphere-secret .sphere-chip-dot { background: #B0853D; }
.sphere-chip.sphere-fear .sphere-chip-dot { background: #792B3B; }
.sphere-chip.sphere-custom .sphere-chip-dot {
  background: transparent;
  border: 1px dashed var(--vtt-text-muted);
  width: 6px;
  height: 6px;
}
.sphere-chip.is-empty {
  border-style: dashed;
  color: var(--vtt-text-muted);
  background: transparent;
}
</style>
