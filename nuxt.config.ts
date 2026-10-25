import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

const pwaPlugins = VitePWA({
  strategies: 'generateSW',
  registerType: 'autoUpdate',
  injectRegister: false,
  // Nuxt builds the client with a relative Vite base, which would register ./sw.js and fail on deep links.
  base: '/',
  scope: '/',
  manifest: false,
  outDir: fileURLToPath(new URL('./.output/public', import.meta.url)),
  workbox: {
    // includeAssets resolves against Vite's publicDir, which Nuxt leaves empty, so the webmanifest is globbed instead.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
    // 200.html and 404.html are copies of the index.html shell.
    globIgnores: ['**/dice-assets/**', '200.html', '404.html'],
    dontCacheBustURLsMatching: /^_nuxt\//,
    navigateFallback: '/index.html',
    // /_/ is PocketBase's admin UI; a bare /^\/_/ would also catch Nuxt's /_nuxt/ assets.
    navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith('/dice-assets/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'dice-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/'),
        handler: 'NetworkOnly',
      },
    ],
  },
  devOptions: { enabled: false },
})

export default defineNuxtConfig({
  compatibilityDate: '2026-10-25',
  ssr: false,
  imports: { autoImport: false },
  components: { dirs: [] },
  modules: ['@pinia/nuxt'],
  alias: { '@': fileURLToPath(new URL('./app', import.meta.url)) },
  css: ['~/assets/main.css'],
  typescript: {
    tsConfig: {
      compilerOptions: {
        // Nuxt turns this on by default; the Vite build never had it, and enabling it is not part of the port.
        noUncheckedIndexedAccess: false,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
    },
  },
  nitro: {
    // The generated copy would make nginx redirect /character/new to /character/new/; the SPA fallback serves it.
    prerender: { ignore: ['/character'] },
  },
  runtimeConfig: {
    public: {
      pbUrl: process.env.VITE_PB_URL ?? 'http://127.0.0.1:8090',
    },
  },
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
      __PUBLIC_BASE__: JSON.stringify('/'),
    },
  },
  hooks: {
    'vite:extendConfig'(config, { isClient }) {
      if (!isClient) return
      // The build plugin would write sw.js into the client bundle dir, which Nitro never copies to
      // .output/public; the worker is generated after Nitro has assembled the output instead.
      config.plugins?.push(pwaPlugins.filter((p) => p.name !== 'vite-plugin-pwa:build'))
    },
    async 'nitro:build:public-assets'(nitro) {
      const generateSW = pwaPlugins.find((p) => p.name === 'vite-plugin-pwa')?.api?.generateSW
      if (!generateSW) {
        throw new Error('vite-plugin-pwa plugin or its api.generateSW not found; the build would ship without a service worker')
      }
      await generateSW()
      const swPath = join(nitro.options.output.publicDir, 'sw.js')
      if (!existsSync(swPath)) throw new Error(`Service worker was not generated at ${swPath}`)
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
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
