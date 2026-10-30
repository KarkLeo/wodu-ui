<script setup lang="ts">
import { computed } from 'vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import type { ItemKindFilter } from '@/types/library'
import { t } from '@/locales'

const kind = defineModel<ItemKindFilter>({ required: true })

const KINDS: ItemKindFilter[] = ['all', 'weapon', 'armor', 'shield', 'tool', 'gear', 'occult', 'custom']
const options = computed(() => KINDS.map(value => ({ value, label: t(`library.items.kinds.${value}`) })))
</script>

<template>
  <SegmentedFilter
    v-model="kind"
    :options="options"
    variant="pill"
    full-width
    :aria-label="t('library.items.kindFilter')"
  />
</template>
