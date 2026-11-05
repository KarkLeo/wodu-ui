import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import EncounterPickRow from './EncounterPickRow.vue'
import { MONSTERS } from '@/stories/fixtures'

const meta = {
  title: 'Encounter/EncounterPickRow',
  component: EncounterPickRow,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { monster: MONSTERS[1]!, count: 0, onAdd: fn() },
  render: (args) => ({
    components: { EncounterPickRow },
    setup: () => ({ args }),
    template: '<ul style="margin: 0; padding: 0; list-style: none"><EncounterPickRow v-bind="args" /></ul>',
  }),
} satisfies Meta<typeof EncounterPickRow>

export default meta
type Story = StoryObj<typeof meta>

/** Name, HP and damage; no count until something was added. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Goblin')).toBeVisible()
    await expect(canvas.getByText('3 HP')).toBeVisible()
    await expect(canvas.getByText('1d6')).toBeVisible()
    await expect(canvas.queryByRole('status')).toBeNull()
  },
}

/** Add emits on every press; it is never disabled. */
export const AddsOnEveryPress: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const add = within(canvasElement).getByRole('button', { name: 'Add' })
    await userEvent.click(add)
    await userEvent.click(add)
    await expect(args.onAdd).toHaveBeenCalledTimes(2)
    await expect(add).toBeEnabled()
  },
}

export const WithCount: Story = {
  args: { count: 3 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('3 added')
  },
}

export const LongName: Story = {
  args: { monster: MONSTERS[2]! },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Add' })).toBeVisible()
  },
}
