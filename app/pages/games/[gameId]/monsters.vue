<script setup lang="ts">
import { definePageMeta } from '#imports'
import MonsterLibraryView from '@/features/monster-library/MonsterLibraryView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game-monsters', middleware: 'game' })

useRouteRecheck()
</script>

<template>
  <MonsterLibraryView />
</template>
