<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharactersView from '@/features/cabinet/CharactersView.vue'

definePageMeta({ name: 'characters', shell: 'cabinet' })
</script>

<template>
  <CharactersView />
</template>
