<script setup lang="ts">
import { definePageMeta } from '#imports'
import PartyView from '@/features/in-game/PartyView.vue'

definePageMeta({ name: 'party', middleware: 'party' })
</script>

<template>
  <PartyView />
</template>
