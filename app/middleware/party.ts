import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useCharactersStore } from '@/stores/characters'
import { partyGuard } from '@/utils/routeGuards'
import { onlineDataReady } from '@/transport/bootstrap'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = partyGuard(to.params.ids as string, useCharactersStore().getById, onlineDataReady.value)
  if (redirect) return navigateTo(redirect)
})
