<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/locales'
import { matchSpherePreset } from '@/locales/content'
import type { SpherePresetId } from '@/data/spheres'

const props = defineProps<{
  value?: string
  placeholder?: string
}>()

const CLASS_BY_PRESET: Record<SpherePresetId, string> = {
  fire: 'sphere-fire',
  shadow: 'sphere-shadow',
  stone: 'sphere-stone',
  lightning: 'sphere-storm',
  mysteries: 'sphere-secret',
  fear: 'sphere-fear',
}

const presetClass = computed(() => {
  if (!props.value) return ''
  const id = matchSpherePreset(props.value)
  return id ? CLASS_BY_PRESET[id] : 'sphere-custom'
})

const isEmpty = computed(() => !props.value)
const label = computed(() => props.value || props.placeholder || t('inGame.magic.spirits.sphereEmpty'))
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
