<script setup lang="ts">
import { computed } from 'vue'
import SegmentedFilter from './SegmentedFilter.vue'
import { LOCALES, type Locale } from '@/locales'

// Only shows and reports the choice: each caller decides what a switch does (the local UI language,
// or the profile's as well).
withDefaults(defineProps<{
  /** `pill` in a settings row or over the artwork, `plain` in a footer. */
  variant?: 'pill' | 'plain'
}>(), {
  variant: 'plain',
})

const model = defineModel<Locale>({ required: true })

const options = computed(() => LOCALES.map(l => ({ value: l, label: l.toUpperCase() })))
</script>

<template>
  <SegmentedFilter v-model="model" :options="options" :variant="variant" />
</template>
