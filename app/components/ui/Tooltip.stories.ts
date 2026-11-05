import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import Tooltip from './Tooltip.vue'

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  args: { text: 'Two-handed executioner’s great axe' },
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { Tooltip },
    setup: () => ({ args }),
    template: '<Tooltip v-bind="args"><span data-testid="trigger" style="padding: 8px">Great axe</span></Tooltip>',
  }),
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

const page = (el: HTMLElement) => within(el.ownerDocument.body)
const trigger = (el: HTMLElement) => within(el).getByTestId('trigger')
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

/** What a tap sends: the touch's pointerleave comes before its click, and that closes an open tooltip. */
function tap(el: HTMLElement) {
  for (const type of ['pointerenter', 'pointerdown', 'pointerup', 'pointerleave']) {
    el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', bubbles: type !== 'pointerenter' && type !== 'pointerleave' }))
  }
  el.click()
}

/** The pointer on it, after a moment; gone with the pointer. */
export const Default: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    await userEvent.hover(trigger(canvasElement))
    await expect(await page(canvasElement).findByRole('tooltip')).toHaveTextContent(args.text)
    await userEvent.unhover(trigger(canvasElement))
    await waitFor(() => expect(page(canvasElement).queryByRole('tooltip')).toBeNull())
  },
}

/** Line breaks in the text show. */
export const TwoLines: Story = {
  tags: ['no-visual'],
  args: { text: 'Damage · Great axe · Brann Ironhide\n1d6+1 · 5' },
  play: async ({ canvasElement }) => {
    await userEvent.hover(trigger(canvasElement))
    await page(canvasElement).findByRole('tooltip')
    const content = canvasElement.ownerDocument.querySelector<HTMLElement>('.ui-tooltip')!
    await expect(getComputedStyle(content).whiteSpace).toBe('pre-line')
    await userEvent.unhover(trigger(canvasElement))
  },
}

/** `check` says there is nothing to add: no tooltip. */
export const NothingToAdd: Story = {
  tags: ['no-visual'],
  args: { check: () => false },
  play: async ({ canvasElement }) => {
    await userEvent.hover(trigger(canvasElement))
    await pause(450)
    await expect(page(canvasElement).queryByRole('tooltip')).toBeNull()
    await userEvent.unhover(trigger(canvasElement))
  },
}

export const Disabled: Story = {
  tags: ['no-visual'],
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await userEvent.hover(trigger(canvasElement))
    await pause(450)
    await expect(page(canvasElement).queryByRole('tooltip')).toBeNull()
    await userEvent.unhover(trigger(canvasElement))
  },
}

/** With `tap`, one tap opens it and the next closes it. */
export const TapToggles: Story = {
  tags: ['no-visual'],
  args: { tap: true },
  play: async ({ canvasElement, args }) => {
    tap(trigger(canvasElement))
    await expect(await page(canvasElement).findByRole('tooltip')).toHaveTextContent(args.text)
    tap(trigger(canvasElement))
    await waitFor(() => expect(page(canvasElement).queryByRole('tooltip')).toBeNull())
  },
}

/** A tap elsewhere closes it. */
export const TapOutsideCloses: Story = {
  tags: ['no-visual'],
  args: { tap: true },
  play: async ({ canvasElement }) => {
    tap(trigger(canvasElement))
    await page(canvasElement).findByRole('tooltip')
    await pause(50)
    const outside = canvasElement.ownerDocument.body
    outside.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    outside.click()
    await waitFor(() => expect(page(canvasElement).queryByRole('tooltip')).toBeNull())
  },
}

/** Without `tap`, a tap belongs to the element: no tooltip. */
export const TapIgnoredByDefault: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    tap(trigger(canvasElement))
    await pause(450)
    await expect(page(canvasElement).queryByRole('tooltip')).toBeNull()
  },
}

/** `check` also decides for a tap. */
export const TapWithNothingToAdd: Story = {
  tags: ['no-visual'],
  args: { tap: true, check: () => false },
  play: async ({ canvasElement }) => {
    tap(trigger(canvasElement))
    await pause(100)
    await expect(page(canvasElement).queryByRole('tooltip')).toBeNull()
  },
}
