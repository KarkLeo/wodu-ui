import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-a11y'],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // The app's vite.config.ts is loaded as-is; the PWA plugin would emit a service worker into the Storybook build.
    const plugins = (config.plugins ?? []).flat()
    return {
      ...config,
      plugins: plugins.filter((p) => !(p && 'name' in p && p.name.startsWith('vite-plugin-pwa'))),
    }
  },
}

export default config
