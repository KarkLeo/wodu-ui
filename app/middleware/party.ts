import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { partyRouteRedirect } from '@/composables/useRouteRecheck'
import { onlineDataReady } from '@/transport/bootstrap'

export default defineNuxtRouteMiddleware((to) => {
  const redirect = partyRouteRedirect(to.params.ids as string | undefined, onlineDataReady.value)
  if (redirect) return navigateTo(redirect)
})
