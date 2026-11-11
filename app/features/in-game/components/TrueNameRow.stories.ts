import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import TrueNameRow from './TrueNameRow.vue'

const meta = {
  title: 'Panels/StatusHeader/TrueNameRow',
  component: TrueNameRow,
  args: { name: 'Ashen Wolf of the Low Road' },
  decorators: [() => ({ template: '<div style="display: flex; flex-direction: column; max-width: 240px"><story /></div>' })],
} satisfies Meta<typeof TrueNameRow>

export default meta
type Story = StoryObj<typeof meta>

/** Masked by default; the stars never give away how long the name is. */
export const Masked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'True name' })).toHaveAttribute('aria-pressed', 'false')
    await expect(canvas.queryByText('Ashen Wolf of the Low Road')).toBeNull()
  },
}

/** A click shows the name. */
export const Revealed: Story = {
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: 'True name' })
    await userEvent.click(row)
    await expect(row).toHaveAttribute('aria-pressed', 'true')
    await expect(row).toHaveAccessibleName('True name Ashen Wolf of the Low Road')
  },
}

/** Another click hides it again. */
export const HidesAgain: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('button', { name: 'True name' })
    await userEvent.click(row)
    await userEvent.click(row)
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    await expect(canvas.queryByText('Ashen Wolf of the Low Road')).toBeNull()
  },
}
