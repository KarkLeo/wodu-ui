<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterCreationView from '@/features/character-creation/CharacterCreationView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game-character-new', middleware: 'game' })

useRouteRecheck()
</script>

<template>
  <CharacterCreationView />
</template>
