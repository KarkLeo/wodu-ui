<script setup lang="ts">
import { computed } from 'vue'
import SegmentedFilter from './SegmentedFilter.vue'
import type { AppMode } from '@/transport/mode'
import { t } from '@/locales'

const model = defineModel<AppMode>({ required: true })

const options = computed(() => [
  { value: 'online' as const, label: t('mode.online') },
  { value: 'offline' as const, label: t('mode.offline') },
])
</script>

<template>
  <SegmentedFilter v-model="model" :options="options" variant="block" full-width />
</template>
