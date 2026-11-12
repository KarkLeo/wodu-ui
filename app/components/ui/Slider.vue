<script setup lang="ts">
import { computed } from 'vue'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

withDefaults(defineProps<{
  min?: number
  max?: number
  step?: number
  ariaLabel: string
  disabled?: boolean
}>(), {
  min: 0,
  max: 1,
  step: 0.05,
})

const model = defineModel<number>({ required: true })

const values = computed({
  get: () => [model.value],
  set: (v) => {
    const next = v?.[0]
    if (next !== undefined && next !== model.value) model.value = next
  },
})
</script>

<template>
  <SliderRoot
    v-model="values"
    class="slider"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
  >
    <SliderTrack class="slider-track">
      <SliderRange class="slider-range" />
    </SliderTrack>
    <SliderThumb class="slider-thumb" :aria-label="ariaLabel" />
  </SliderRoot>
</template>

<style scoped>
.slider {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 24px;
  touch-action: none;
  user-select: none;
}
.slider[data-disabled] { opacity: 0.5; }
.slider-track {
  position: relative;
  flex-grow: 1;
  height: 6px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
}
.slider-range {
  position: absolute;
  height: 100%;
  background: var(--vtt-accent);
  border-radius: var(--r-pill);
}
.slider-thumb {
  display: block;
  width: 16px;
  height: 16px;
  background: var(--vtt-accent-soft);
  border: 1.5px solid var(--vtt-accent);
  border-radius: var(--r-pill);
  cursor: grab;
}
.slider[data-disabled] .slider-thumb { cursor: not-allowed; }
.slider-thumb:focus-visible { outline: 2px solid var(--vtt-accent); outline-offset: 2px; }
</style>
