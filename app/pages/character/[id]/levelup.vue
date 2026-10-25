<script setup lang="ts">
import { watch } from 'vue'
import { definePageMeta, navigateTo, useRoute } from '#imports'
import LevelUpView from '@/features/level-up/LevelUpView.vue'
import { useCharactersStore } from '@/stores/characters'
import { levelUpGuard } from '@/utils/routeGuards'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'

definePageMeta({ name: 'level-up', middleware: 'level-up' })

const route = useRoute()
const characters = useCharactersStore()

// See pages/party/[ids].vue: re-run the guard the middleware skipped while the online load had failed.
watch(onlineDataReady, (ready) => {
  if (!ready || mode.value !== 'online') return
  const redirect = levelUpGuard(route.params.id as string, characters.getById)
  if (redirect) void navigateTo(redirect)
})
</script>

<template>
  <LevelUpView />
</template>
