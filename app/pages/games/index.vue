<script setup lang="ts">
import { definePageMeta } from '#imports'
import HomeView from '@/features/home/HomeView.vue'

// Today's Home (games and characters tabs) until the cabinet pages replace it.
definePageMeta({ name: 'games' })
</script>

<template>
  <HomeView />
</template>
