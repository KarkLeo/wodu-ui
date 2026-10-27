<script setup lang="ts">
import { definePageMeta } from '#imports'
import GamesView from '@/features/cabinet/GamesView.vue'

// `cabinet`: app.vue renders it under the cabinet header, behind sign-in, without the table's panels.
definePageMeta({ name: 'games', shell: 'cabinet' })
</script>

<template>
  <GamesView />
</template>
