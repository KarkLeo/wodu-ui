import { registerSW } from 'virtual:pwa-register'
import { updateReady } from './updateState'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export const updateSW = registerSW({
  immediate: true,
  // autoUpdate would reload the page as soon as a new worker activates, which can land mid-request
  // (e.g. while the creation wizard saves a draft). The new build is offered instead; it also loads
  // on the next start.
  onNeedReload() {
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
