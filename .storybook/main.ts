import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'
import { alias, define, toAliasArray } from './vite.shared.ts'

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../app/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: {
    disableTelemetry: true,
  },
  // The single place the shared alias and defines are applied: storybook dev/build and the Vitest storybookTest plugin both run viteFinal.
  async viteFinal(config) {
    return {
      ...config,
      // Storybook has no vite.config.ts to take the Vue plugin from; the Vitest projects already carry it from vitest.config.ts.
      plugins: process.env.VITEST ? config.plugins : [...(config.plugins ?? []), vue()],
      // Storybook builds with base './', which keeps public/ paths valid under the GitHub Pages subpath.
      define: { ...config.define, ...define, __PUBLIC_BASE__: JSON.stringify(config.base ?? '/') },
      resolve: { ...config.resolve, alias: [...alias, ...toAliasArray(config.resolve?.alias)] },
    }
  },
}

export default config
