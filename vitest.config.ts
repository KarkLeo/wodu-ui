import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __PUBLIC_BASE__: JSON.stringify('/'),
  },
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'app') },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          globals: true,
          // tests/e2e/ holds a Playwright scaffold that vitest cannot run.
          include: ['app/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: '.storybook', storybookScript: 'npm run storybook -- --ci' })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: '.storybook',
            tags: { exclude: ['no-visual'] },
            storybookScript: 'npm run storybook -- --ci',
          }),
        ],
        test: {
          name: 'visual',
          setupFiles: ['.storybook/visual.setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            expect: {
              toMatchScreenshot: {
                // Paths carry no directory, browser or platform so that moving sources does not orphan the baseline.
                resolveScreenshotPath: ({ testFileName, testName, ext }) =>
                  resolve(import.meta.dirname, '.visual/baseline', testFileName, testName + ext),
                resolveDiffPath: ({ testFileName, testName, ext }) =>
                  resolve(import.meta.dirname, '.visual/diff', testFileName, testName + ext),
              },
            },
          },
        },
      },
    ],
  },
})
