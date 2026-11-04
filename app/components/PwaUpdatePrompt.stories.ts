import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import PwaUpdatePrompt from './PwaUpdatePrompt.vue'
import { t } from '@/locales'
import { updateReady } from '@/pwa/updateState'

const updateWaiting: Decorator = (story) => ({
  components: { story },
  setup() {
    updateReady.value = true
    onUnmounted(() => {
      updateReady.value = false
    })
  },
  template: '<story />',
})

const meta = {
  title: 'Layout/PwaUpdatePrompt',
  component: PwaUpdatePrompt,
  parameters: { layout: 'fullscreen' },
  decorators: [updateWaiting],
} satisfies Meta<typeof PwaUpdatePrompt>

export default meta
type Story = StoryObj<typeof meta>

/** A new service worker is waiting. */
export const Available: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent(t('pwa.updateAvailable'))
    await expect(canvas.getByRole('button', { name: t('pwa.update') })).toBeEnabled()
  },
}

/** The worker is taking over: the action stays disabled until the page reloads. */
export const Updating: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: t('pwa.update') }))
    await expect(await canvas.findByRole('button', { name: t('pwa.updating') })).toBeDisabled()
  },
}

/** Closing it keeps the old build for now. */
export const Dismissed: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: t('common.close') }))
    await expect(canvas.queryByRole('status')).toBeNull()
  },
}
