import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SpiritCard from './SpiritCard.vue'
import type { Spirit } from '@/types/character'
import { mirel } from '@/stories/fixtures'
import { expectNoEditControls, readonlySheet } from '@/stories/readonly'

const illas = mirel.magic!.spirits[0]!
const blank: Spirit = { id: 'story-spirit-blank', name: '', appearance: '', sphere1: '', sphere2: '' }

const meta = {
  title: 'Panels/Magic/SpiritCard',
  component: SpiritCard,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { spirit: illas, onUpdate: fn(), onRemove: fn() },
} satisfies Meta<typeof SpiritCard>

export default meta
type Story = StoryObj<typeof meta>

export const Bound: Story = {}

export const Empty: Story = {
  args: { spirit: blank },
}

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Edit' }))
    await expect(within(canvasElement).getByDisplayValue('Illas of the Sparks')).toBeVisible()
  },
}

/** On a read-only sheet: name, appearance and domains, no edit or remove. */
export const ReadOnly: Story = {
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Illas of the Sparks')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

/** An empty spirit on a read-only sheet: no "describe it" hint, and a tap opens nothing. */
export const ReadOnlyEmpty: Story = {
  args: { spirit: blank },
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('New spirit'))
    await expect(canvas.queryByRole('textbox')).toBeNull()
    await expect(canvas.queryByText('Describe its name, appearance, and two domains of power.')).toBeNull()
    await expectNoEditControls(canvasElement)
  },
}
