import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'site.webmanifest',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globIgnores: ['**/dice-assets/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/_/],
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
              url.pathname.startsWith('/api/') || url.pathname.startsWith('/_'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
