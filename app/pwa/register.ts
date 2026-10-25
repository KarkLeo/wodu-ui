import { registerSW } from 'virtual:pwa-register'
import { applyUpdate, onApplyUpdate, updateReady } from './updateState'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady.value = true
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    // A worker that was already waiting when this page loaded came from an earlier visit. The page has
    // only just started, so switching to the new build now loses nothing; reloading open tabs keeps
    // their old shell otherwise, since the worker cannot activate while any of them is open.
    if (registration.waiting) void applyUpdate()

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
