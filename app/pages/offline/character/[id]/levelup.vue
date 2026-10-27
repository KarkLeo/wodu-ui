<script setup lang="ts">
import { definePageMeta } from '#imports'
import LevelUpView from '@/features/level-up/LevelUpView.vue'

definePageMeta({ name: 'offline-level-up', middleware: 'level-up' })
</script>

<template>
  <LevelUpView />
</template>
