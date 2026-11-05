import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import ToggleChip from './ToggleChip.vue'

const meta = {
  title: 'UI/ToggleChip',
  component: ToggleChip,
  args: { label: 'Poisoned', pressed: false },
  render: (args) => ({
    components: { ToggleChip },
    setup() {
      const on = ref(args.pressed)
      return { args, on }
    },
    template: '<ToggleChip :label="args.label" :pressed="on" @toggle="on = !on" />',
  }),
  parameters: {
    docs: { description: { component: 'A small on/off tag: a dashed outline while off, a filled gold capsule while on. Used for the conditions of a monster.' } },
  },
} satisfies Meta<typeof ToggleChip>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Poisoned' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const On: Story = {
  args: { pressed: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Poisoned' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const Toggles: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole('button', { name: 'Poisoned' })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
  },
}
