<script setup lang="ts">
import { definePageMeta } from '#imports'
import GameSettingsView from '@/features/game-settings/GameSettingsView.vue'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game-settings', middleware: 'game' })

useRouteRecheck()
</script>

<template>
  <GameSettingsView />
</template>
