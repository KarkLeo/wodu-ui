import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { cpSync, existsSync, mkdirSync } from 'fs'

function copyDiceBoxAssets() {
  return {
    name: 'copy-dice-box-assets',
    buildStart() {
      const src = resolve(__dirname, 'node_modules/@3d-dice/dice-box/dist/assets')
      const dest = resolve(__dirname, 'public/assets')
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [vue(), copyDiceBoxAssets()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
