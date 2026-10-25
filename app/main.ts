import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'
import App from './app.vue'
import router from './router'

import './assets/fonts'
import './assets/main.css'

import { bootstrap } from '@/transport/bootstrap'

const pinia = createPinia()
pinia.use(piniaPersistedstate)

const app = createApp(App).use(pinia).use(router)

void (async () => {
  await bootstrap()
  app.mount('#app')
  if (import.meta.env.PROD) {
    void import('@/pwa/register')
  }
})()
