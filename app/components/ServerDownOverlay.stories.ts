import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { onMounted, ref } from 'vue'
import ServerDownOverlay from './ServerDownOverlay.vue'
import { atRoute } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import BottomSheet from './ui/BottomSheet.vue'
import Button from './ui/Button.vue'

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

// The overlay is portalled to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

function hitsElement(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect()
  const hit = el.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
  return hit !== null && (hit === el || el.contains(hit))
}

export const Reconnecting: Story = {}

export const ManyAttempts: Story = {
  args: { attempt: 6 },
}

export const NoInternet: Story = {
  args: { noInternet: true, attempt: 2 },
  play: async ({ canvasElement }) => {
    const dialog = await screen(canvasElement).findByRole('alertdialog', { name: 'Server unavailable' })
    await expect(within(dialog).getByText(/No internet connection/)).toBeVisible()
    await expect(within(dialog).queryByText(/Can’t reach the game server/)).toBeNull()
  },
}

/** Retry asks the parent; "Play offline" opens the offline table. */
export const RetryAndPlayOffline: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  loaders: [atRoute('/games')],
  play: async ({ args, canvasElement }) => {
    const dialog = await screen(canvasElement).findByRole('alertdialog', { name: 'Server unavailable' })
    const retry = within(dialog).getByRole('button', { name: 'Retry' })
    await expect(retry).toHaveFocus()

    await userEvent.click(retry)
    await expect(args.onRetry).toHaveBeenCalledOnce()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Play offline' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/offline'))

    await expect(hitsElement(screen(canvasElement).getByTestId('behind'))).toBe(false)
  },
}

/** A probe is already in flight: Retry shows as unavailable instead of swallowing the click. */
export const Probing: Story = {
  args: { attempt: 3, probing: true },
  play: async ({ args, canvasElement }) => {
    const retry = await screen(canvasElement).findByRole('button', { name: 'Retry' })
    await expect(retry).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(retry)
    await expect(args.onRetry).not.toHaveBeenCalled()
  },
}

/**
 * The server drops while a sheet is open (inventory and catalog writes happen inside sheets): the
 * overlay must take pointer events and focus from the sheet, which lives outside the inert layout.
 */
export const OverOpenSheet: Story = {
  parameters: { navigationNotice: false },
  loaders: [atRoute('/games')],
  render: (args) => ({
    components: { ServerDownOverlay, BottomSheet, Button },
    setup() {
      const sheetOpen = ref(true)
      const down = ref(false)
      onMounted(() => { setTimeout(() => { down.value = true }, 50) })
      return { args, sheetOpen, down }
    },
    template: `
      <div style="min-height: 100dvh">
        <BottomSheet v-model:open="sheetOpen" title="Catalog">
          <Button variant="primary" data-testid="sheet-action">Add to inventory</Button>
        </BottomSheet>
        <ServerDownOverlay v-if="down" v-bind="args" />
      </div>
    `,
  }),
  play: async ({ args, canvasElement }) => {
    const body = screen(canvasElement)
    const dialog = await body.findByRole('alertdialog', { name: 'Server unavailable' })
    const retry = within(dialog).getByRole('button', { name: 'Retry' })
    await expect(retry).toHaveFocus()

    await userEvent.click(retry)
    await expect(args.onRetry).toHaveBeenCalledOnce()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Play offline' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/offline'))

    await expect(hitsElement(body.getByTestId('sheet-action'))).toBe(false)
  },
}
