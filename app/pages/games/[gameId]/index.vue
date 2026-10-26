<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game', middleware: 'game' })

useRouteRecheck()
</script>

<template>
  <CharacterListView />
</template>
