<script setup lang="ts">
import { watch } from 'vue'
import { definePageMeta, navigateTo, useRoute } from '#imports'
import PartyView from '@/features/in-game/PartyView.vue'
import { useCharactersStore } from '@/stores/characters'
import { partyGuard } from '@/utils/routeGuards'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'

definePageMeta({ name: 'party', middleware: 'party' })

const route = useRoute()
const characters = useCharactersStore()

// The middleware lets a deep link through while the online load has failed; check it again once
// the data arrives. A switch to offline also makes the data "ready", but it navigates away itself.
watch(onlineDataReady, (ready) => {
  if (!ready || mode.value !== 'online') return
  const redirect = partyGuard(route.params.ids as string, characters.getById)
  if (redirect) void navigateTo(redirect)
})
</script>

<template>
  <PartyView />
</template>
