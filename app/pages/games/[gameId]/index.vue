<script setup lang="ts">
import { definePageMeta } from '#imports'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { useEncounterPanelShown } from '@/composables/useTableSelection'
import { useRouteRecheck } from '@/composables/useRouteRecheck'

definePageMeta({ name: 'game', middleware: 'game' })

useRouteRecheck()
// The master's open encounter panel takes the table's tray even with no sheet open.
const showEncounter = useEncounterPanelShown()
</script>

<template>
  <PartyView v-if="showEncounter" />
  <CharacterListView v-else />
</template>
