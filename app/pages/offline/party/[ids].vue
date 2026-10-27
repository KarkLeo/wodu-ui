<script setup lang="ts">
import { definePageMeta } from '#imports'
import PartyView from '@/features/in-game/PartyView.vue'

// Offline data is loaded before the middleware runs, so there is nothing to re-check later.
definePageMeta({ name: 'offline-party', middleware: 'party' })
</script>

<template>
  <PartyView />
</template>
