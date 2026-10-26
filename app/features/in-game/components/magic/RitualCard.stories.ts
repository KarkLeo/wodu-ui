import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import RitualCard from './RitualCard.vue'
import type { Ritual } from '@/types/character'
import { mirel } from '@/stories/fixtures'
import { expectNoEditControls, readonlySheet } from '@/stories/readonly'

const whisper = mirel.magic!.rituals[0]!
const blank: Ritual = { name: '', description: '' }

const meta = {
  title: 'Panels/Magic/RitualCard',
  component: RitualCard,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { ritual: whisper, onUpdate: fn(), onRemove: fn() },
} satisfies Meta<typeof RitualCard>

export default meta
type Story = StoryObj<typeof meta>

export const Known: Story = {}

export const Empty: Story = {
  args: { ritual: blank },
}

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Edit' }))
    await expect(within(canvasElement).getByDisplayValue('Whisper of Stone')).toBeVisible()
  },
}

/** On a read-only sheet: the ritual still expands to read, but has no edit or remove. */
export const ReadOnly: Story = {
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Ask the walls what they have witnessed.'))
    await expect(canvasElement.querySelector('.ritual-card')).toHaveClass('is-expanded')
    await expectNoEditControls(canvasElement)
  },
}

/** An empty ritual on a read-only sheet: no "tap the pencil" hint and nothing to open. */
export const ReadOnlyEmpty: Story = {
  args: { ritual: blank },
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('New ritual')).toBeVisible()
    await expect(canvas.queryByText('Tap the pencil to describe the ritual.')).toBeNull()
    await expectNoEditControls(canvasElement)
  },
}
