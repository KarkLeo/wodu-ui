import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useCharactersStore } from '@/stores/characters'
import { levelUpGuard } from '@/utils/routeGuards'
import { onlineDataReady } from '@/transport/bootstrap'

export default defineNuxtRouteMiddleware((to) => {
  const characters = useCharactersStore()
  const redirect = levelUpGuard(
    to.params.id as string,
    characters.getById,
    onlineDataReady.value,
    characters.canEditCharacter,
    id => characters.metaOf(id)?.game ?? '',
  )
  if (redirect) return navigateTo(redirect)
})
