import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.env.PROD) return
  nuxtApp.hook('app:mounted', () => {
    void import('@/pwa/register')
  })
})
