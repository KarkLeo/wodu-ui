<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import HomeView from '@/features/home/HomeView.vue'
import { mode } from '@/transport/mode'

definePageMeta({ name: 'character-list' })
</script>

<template>
  <HomeView v-if="mode === 'online'" />
  <CharacterListView v-else />
</template>
