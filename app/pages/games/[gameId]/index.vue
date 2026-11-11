<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { useTrayCards } from '@/composables/useTrayCards'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game', middleware: 'game' })

useRouteRecheck()
// The master's open cards take the table's tray even with no sheet open.
const { shown } = useTrayCards()
</script>

<template>
  <PartyView v-if="shown" />
  <CharacterListView v-else />
</template>
