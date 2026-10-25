import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { pb } from '@/transport/pb'
import { mode } from '@/transport/mode'
import { bootstrap } from '@/transport/bootstrap'
import { startOfflineSession } from '@/composables/useModeSwitch'

export default defineNuxtPlugin(async () => {
  pb.baseURL = useRuntimeConfig().public.pbUrl
  if (mode.value === 'offline') {
    startOfflineSession()
    return
  }
  // Awaited so that the first navigation, its middleware and the first render see a loaded store.
  // bootstrap() gives up after BOOTSTRAP_TIMEOUT_MS, so a hanging server delays the first render
  // instead of blocking it forever; the app then renders and waits for the reconnect.
  await bootstrap()
})
