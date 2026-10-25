import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { alias, define } from './vite.shared.ts'

export default defineConfig({
  define,
  plugins: [vue()],
  resolve: { alias },
})
