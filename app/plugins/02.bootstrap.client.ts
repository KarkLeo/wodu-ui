import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { pb } from '@/transport/pb'
import { mode } from '@/transport/mode'
import { bootstrap } from '@/transport/bootstrap'
import { restoreSession } from '@/transport/auth'
import { startOfflineSession } from '@/composables/useModeSwitch'

export default defineNuxtPlugin(async () => {
  pb.baseURL = useRuntimeConfig().public.pbUrl
  if (mode.value === 'offline') {
    startOfflineSession()
    return
  }
  // An unreachable server keeps the saved session: bootstrap() then times out into the reconnect overlay.
  await restoreSession()
  // Awaited so that the first navigation, its middleware and the first render see a loaded store.
  // bootstrap() gives up after BOOTSTRAP_TIMEOUT_MS, so a hanging server delays the first render
  // instead of blocking it forever; the app then renders and waits for the reconnect.
  // Signed out, it does nothing and app.vue shows the sign-in screen.
  await bootstrap()
})
