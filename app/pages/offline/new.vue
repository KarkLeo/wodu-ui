<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterCreationView from '@/features/character-creation/CharacterCreationView.vue'

definePageMeta({ name: 'offline-character-new' })
</script>

<template>
  <CharacterCreationView />
</template>
