import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import XpControlsPanel from './XpControlsPanel.vue'

const meta = {
  title: 'UI/XpControlsPanel',
  component: XpControlsPanel,
  args: {
    current: 1840,
    max: 3000,
    showHeader: true,
    'onUpdate:current': fn(),
    onLevelUp: fn(),
  },
  decorators: [
    () => ({
      template: `<div style="width: 340px; padding: 16px 18px; background: var(--vtt-bg-elevated);
        border: 1px solid var(--vtt-border-gold); border-radius: var(--r-md)"><story /></div>`,
    }),
  ],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/xp-bar.html`',
      },
    },
  },
} satisfies Meta<typeof XpControlsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {}

export const WithoutHeader: Story = {
  args: { showHeader: false },
}

export const CustomTitle: Story = {
  args: { popoverTitle: 'Brannoc the Fighter' },
}

export const ReadyToLevelUp: Story = {
  args: { current: 3000, isReady: true },
}

/** Each update:current becomes a GAIN_XP dispatch, so a typed value goes out once, on blur or Enter. */
export const TypedValueUpdatesOnce: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const update = args['onUpdate:current']
    const field = canvas.getByRole('spinbutton', { name: 'Input' })

    await userEvent.clear(field)
    await userEvent.type(field, '2500')
    await expect(update).not.toHaveBeenCalled()
    await userEvent.tab()
    await expect(update).toHaveBeenCalledTimes(1)
    await expect(update).toHaveBeenLastCalledWith(2500)

    await userEvent.clear(field)
    await userEvent.type(field, '99')
    await expect(update).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await userEvent.tab()
    await expect(update).toHaveBeenCalledTimes(1)

    await userEvent.clear(field)
    await userEvent.tab()
    await expect(update).toHaveBeenCalledTimes(1)
    await expect(field).toHaveValue(1840)
  },
}

/** Experience may pass the next level's threshold; a typed value is not capped at max. */
export const TypedValuePastMax: Story = {
  play: async ({ args, canvasElement }) => {
    const field = within(canvasElement).getByRole('spinbutton', { name: 'Input' })
    await userEvent.clear(field)
    await userEvent.type(field, '4000')
    await userEvent.keyboard('{Enter}')
    await expect(args['onUpdate:current']).toHaveBeenCalledTimes(1)
    await expect(args['onUpdate:current']).toHaveBeenLastCalledWith(4000)
  },
}

export const StepButtons: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: '+100' }))
    await expect(args['onUpdate:current']).toHaveBeenCalledTimes(1)
    await expect(args['onUpdate:current']).toHaveBeenLastCalledWith(1940)
    await userEvent.click(canvas.getByRole('button', { name: '−10' }))
    await expect(args['onUpdate:current']).toHaveBeenCalledTimes(2)
    await expect(args['onUpdate:current']).toHaveBeenLastCalledWith(1830)
  },
}
