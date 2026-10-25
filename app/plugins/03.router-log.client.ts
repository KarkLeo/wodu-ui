import { defineNuxtPlugin, useRouter } from '#app'
import { createLogger } from '@/utils/logger'

const log = createLogger('router')

export default defineNuxtPlugin(() => {
  useRouter().beforeEach((to, from) => {
    log.debug('navigate', { from: from.fullPath, to: to.fullPath, name: String(to.name) })
  })
})
