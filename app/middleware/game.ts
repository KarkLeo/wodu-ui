import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { applyRedirect, gameRouteRedirect } from '@/composables/useRouteRecheck'
import { onlineDataReady } from '@/transport/bootstrap'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = gameRouteRedirect(
    String(to.name ?? ''),
    String(to.params.gameId ?? ''),
    to.params.ids as string | undefined,
    onlineDataReady.value,
  )
  if (redirect) return navigateTo(applyRedirect(redirect))
})
