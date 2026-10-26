import { defineNuxtRouteMiddleware } from '#app'
import { enterMode } from '@/transport/modeSwitch'
import { modeForPath } from '@/utils/routeMode'

// The mode follows the address, including back/forward between the offline table and the account.
// Global middleware runs before a route's own middleware, so its guards see the target's data.
export default defineNuxtRouteMiddleware((to) => {
  const next = modeForPath(to.path)
  if (next) enterMode(next)
})
