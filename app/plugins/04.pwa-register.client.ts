import { defineNuxtPlugin } from '#app'
import { listenForInstallPrompt } from '@/pwa/useInstall'

export default defineNuxtPlugin((nuxtApp) => {
  listenForInstallPrompt()
  if (!import.meta.env.PROD) return
  nuxtApp.hook('app:mounted', () => {
    void import('@/pwa/register')
  })
})
