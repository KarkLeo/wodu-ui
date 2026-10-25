<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterListView from '@/features/character-list/CharacterListView.vue'

definePageMeta({ name: 'character-list' })
</script>

<template>
  <CharacterListView />
</template>
