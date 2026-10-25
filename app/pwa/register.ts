import { registerSW } from 'virtual:pwa-register'
import { onApplyUpdate, updateReady } from './updateState'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export const updateSW = registerSW({
  immediate: true,
  // Also fires on every start while a worker from an earlier visit is still waiting.
  onNeedRefresh() {
    updateReady.value = true
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const check = () => {
      if (registration.installing || !navigator.onLine) return
      void registration.update().catch(() => {})
    }

    setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})

onApplyUpdate(async () => {
  // registerSW reloads on its own only if the page already had a controller when it registered,
  // which a page opened on the first visit never has.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  await updateSW(true)
})
