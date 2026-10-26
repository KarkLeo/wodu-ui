import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'
import QuicksilverCounter from './QuicksilverCounter.vue'
import { expectNoEditControls, readonlySheet } from '@/stories/readonly'

const meta = {
  title: 'Panels/Magic/QuicksilverCounter',
  component: QuicksilverCounter,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { count: 1, limit: 2, overdose: false, canDrink: true, onDrink: fn(), onReset: fn() },
} satisfies Meta<typeof QuicksilverCounter>

export default meta
type Story = StoryObj<typeof meta>

export const Safe: Story = {}

export const NoMercury: Story = {
  args: { canDrink: false },
}

export const Overdose: Story = {
  args: { count: 3, overdose: true },
}

/** On a read-only sheet: the count and the warning, no drink or new day. */
export const ReadOnly: Story = {
  args: { count: 3, overdose: true },
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Next dose requires a CON roll.')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}
