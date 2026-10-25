import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ServerDownOverlay from './ServerDownOverlay.vue'

const meta = {
  title: 'Layout/ServerDownOverlay',
  component: ServerDownOverlay,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: {
    attempt: 1,
    noInternet: false,
    probing: false,
    onRetry: fn(),
    onPlayOffline: fn(),
  },
  // A stand-in for the app underneath, so the veil has something to cover.
  render: (args) => ({
    components: { ServerDownOverlay },
    setup: () => ({ args }),
    template: `
      <div style="min-height: 100dvh; padding: 24px; display: flex; flex-direction: column; gap: 16px">
        <p class="eyebrow">At the table</p>
        <p style="margin: 0; font-family: var(--font-serif); font-size: 22px; color: var(--vtt-accent-soft)">Brann the Bold</p>
        <button type="button" data-testid="behind" style="align-self: flex-start; padding: 10px 20px">Roll 2d6</button>
        <ServerDownOverlay v-bind="args" />
      </div>
    `,
  }),
} satisfies Meta<typeof ServerDownOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const Reconnecting: Story = {}

export const ManyAttempts: Story = {
  args: { attempt: 6 },
}

export const NoInternet: Story = {
  args: { noInternet: true, attempt: 2 },
}

export const RetryAndPlayOffline: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const screen = within(canvasElement)
    const dialog = await screen.findByRole('alertdialog', { name: 'Server unavailable' })
    const retry = within(dialog).getByRole('button', { name: 'Retry' })
    await expect(retry).toHaveFocus()

    await userEvent.click(retry)
    await expect(args.onRetry).toHaveBeenCalledOnce()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Play offline' }))
    await expect(args.onPlayOffline).toHaveBeenCalledOnce()

    const behind = screen.getByTestId('behind')
    const box = behind.getBoundingClientRect()
    const hit = canvasElement.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    await expect(hit).not.toBe(behind)
    await expect(behind.contains(hit)).toBe(false)
  },
}

/** A probe is already in flight: Retry shows as unavailable instead of swallowing the click. */
export const Probing: Story = {
  args: { attempt: 3, probing: true },
  play: async ({ args, canvasElement }) => {
    const retry = await within(canvasElement).findByRole('button', { name: 'Retry' })
    await expect(retry).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(retry)
    await expect(args.onRetry).not.toHaveBeenCalled()
  },
}
