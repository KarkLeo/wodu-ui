import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'

import '@fontsource/spectral/300.css'
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/400-italic.css'
import '@fontsource/spectral/500.css'
import '@fontsource/spectral/600.css'
import '@fontsource/spectral/700.css'
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/400-italic.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
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
