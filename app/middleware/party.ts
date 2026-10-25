import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useCharactersStore } from '@/stores/characters'
import { partyGuard } from '@/utils/routeGuards'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = partyGuard(to.params.ids as string, useCharactersStore().getById)
  if (redirect) return navigateTo(redirect)
})
