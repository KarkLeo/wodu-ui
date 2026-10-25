import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useCharactersStore } from '@/stores/characters'
import { levelUpGuard } from '@/utils/routeGuards'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = levelUpGuard(to.params.id as string, useCharactersStore().getById)
  if (redirect) return navigateTo(redirect)
})
