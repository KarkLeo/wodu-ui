import type { StorybookConfig } from '@storybook/vue3-vite'
import type { AliasOptions } from 'vite'
import { fileURLToPath } from 'node:url'

const pbMock = fileURLToPath(new URL('./mocks/pb.ts', import.meta.url))

function toAliasArray(alias: AliasOptions | undefined) {
  if (!alias) return []
  return Array.isArray(alias) ? alias : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))
}

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // The app's vite.config.ts is loaded as-is; the PWA plugin would emit a service worker into the Storybook build.
    const plugins = (config.plugins ?? []).flat()
    return {
      ...config,
      plugins: plugins.filter((p) => !(p && 'name' in p && p.name.startsWith('vite-plugin-pwa'))),
      define: { ...config.define, __BUILD_TIMESTAMP__: JSON.stringify('2026-10-22T18:30:00.000Z') },
      resolve: {
        ...config.resolve,
        // Stories never talk to PocketBase; the mock must win over the generic '@' alias.
        alias: [{ find: /^@\/transport\/pb$/, replacement: pbMock }, ...toAliasArray(config.resolve?.alias)],
      },
    }
  },
}

export default config
