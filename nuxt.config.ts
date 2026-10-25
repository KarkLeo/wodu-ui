import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineNuxtConfig({
  compatibilityDate: '2026-10-25',
  ssr: false,
  imports: { autoImport: false },
  modules: ['@pinia/nuxt'],
  // Placeholder: main.css moves to app/assets/ in the next task.
  css: ['~/../src/assets/main.css'],
  runtimeConfig: {
    public: {
      pbUrl: process.env.VITE_PB_URL ?? 'http://127.0.0.1:8090',
    },
  },
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    },
  },
  app: {
    head: {
      title: 'World of Dungeons',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap',
        },
      ],
      style: [{ innerHTML: 'html, body { background: #0E0B08 }' }],
    },
  },
})
