<script setup lang="ts">
import { definePageMeta } from '#imports'
import ItemLibraryView from '@/features/item-library/ItemLibraryView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game-items', middleware: 'game' })

useRouteRecheck()
</script>

<template>
  <ItemLibraryView />
</template>
