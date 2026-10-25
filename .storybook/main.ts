import type { StorybookConfig } from '@storybook/vue3-vite'
import { fileURLToPath } from 'node:url'
import { alias, define, toAliasArray } from './vite.shared.ts'

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../app/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: {
    disableTelemetry: true,
    builder: {
      name: '@storybook/builder-vite',
      options: { viteConfigPath: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) },
    },
  },
  // The Vitest plugin does not read viteConfigPath, so the overrides are applied here as well.
  async viteFinal(config) {
    return {
      ...config,
      // Storybook builds with base './', which keeps public/ paths valid under the GitHub Pages subpath.
      define: { ...config.define, ...define, __PUBLIC_BASE__: JSON.stringify(config.base ?? '/') },
      resolve: { ...config.resolve, alias: [...alias, ...toAliasArray(config.resolve?.alias)] },
    }
  },
}

export default config
