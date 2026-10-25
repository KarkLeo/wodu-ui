import type { StorybookConfig } from '@storybook/vue3-vite'
import { fileURLToPath } from 'node:url'
import { alias, define, toAliasArray } from './vite.shared.ts'

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.stories.ts'],
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
      define: { ...config.define, ...define },
      resolve: { ...config.resolve, alias: [...alias, ...toAliasArray(config.resolve?.alias)] },
    }
  },
}

export default config
