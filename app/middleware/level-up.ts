import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useCharactersStore } from '@/stores/characters'
import { levelUpGuard } from '@/utils/routeGuards'
import { onlineDataReady } from '@/transport/bootstrap'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = levelUpGuard(to.params.id as string, useCharactersStore().getById, onlineDataReady.value)
  if (redirect) return navigateTo(redirect)
})
