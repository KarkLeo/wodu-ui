import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import ToastHost from './ToastHost.vue'
import { t } from '@/locales'
import { useToastsStore, type ToastKind } from '@/stores/toasts'

// Long enough that a toast never expires under a screenshot; each story clears its own on the way out.
const KEEP_MS = 10 * 60 * 1000

function withToasts(...items: { text: () => string; kind: ToastKind }[]): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const toasts = useToastsStore()
      toasts.clearAll()
      for (const { text, kind } of items) toasts.push(text(), kind, KEEP_MS)
      onUnmounted(() => toasts.clearAll())
    },
    template: '<story />',
  })
}

const info = { text: () => t('errors.rollSyncFailed'), kind: 'info' as const }
const error = { text: () => t('errors.readOnly'), kind: 'error' as const }

const meta = {
  title: 'Layout/ToastHost',
  component: ToastHost,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ToastHost>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = {
  decorators: [withToasts(info)],
}

export const Error: Story = {
  decorators: [withToasts(error)],
}

/** A newer toast stacks under the older one. */
export const Stacked: Story = {
  decorators: [withToasts(info, error)],
}

/** A click dismisses that toast and no other. */
export const ClickDismisses: Story = {
  tags: ['no-visual'],
  decorators: [withToasts(info, error)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: error.text() }))
    await expect(canvas.queryByRole('button', { name: error.text() })).toBeNull()
    await expect(canvas.getByRole('button', { name: info.text() })).toBeInTheDocument()
  },
}
