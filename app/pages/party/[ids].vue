<script setup lang="ts">
import { definePageMeta } from '#imports'
import PartyView from '@/features/in-game/PartyView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'party', middleware: 'party' })

useRouteRecheck()
</script>

<template>
  <PartyView />
</template>
