import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ItemRow from './ItemRow.vue'
import { ITEMS } from '@/stories/fixtures'

const byId = (id: string) => ITEMS.find(i => i.id === id)!
const sword = byId('story-item-sword')

const meta = {
  title: 'Library/ItemRow',
  component: ItemRow,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    item: { ...sword, notes: 'Notched near the hilt.' },
    expanded: false,
    'onUpdate:expanded': fn(),
    onGive: fn(),
    onEdit: fn(),
    onDuplicate: fn(),
    onDelete: fn(),
  },
  // A row is a list item; it lives in the screen's list.
  render: (args) => ({
    components: { ItemRow },
    setup: () => ({ args }),
    template: '<ul style="margin: 0; padding: 0"><ItemRow v-bind="args" /></ul>',
  }),
} satisfies Meta<typeof ItemRow>

export default meta
type Story = StoryObj<typeof meta>

/** Closed: the name and the chips the master looks up (damage, reach, price). */
export const Closed: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const head = canvas.getByRole('button', { name: /Longsword/ })
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(head).toHaveTextContent(/1d8.*melee.*40 s/)
    await expect(canvas.queryByRole('button', { name: 'Give' })).toBeNull()
    await userEvent.click(head)
    await expect(args['onUpdate:expanded']).toHaveBeenCalledWith(true)
  },
}

/** Open: the notes, then Give first, then edit, copy and delete. */
export const Expanded: Story = {
  args: { expanded: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Longsword/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Notched near the hilt.')).toBeVisible()
    await expect(canvas.getAllByRole('button').slice(1).map(b => b.textContent?.trim())).toEqual(['Give', 'Edit', 'Copy', 'Delete'])
    await userEvent.click(canvas.getByRole('button', { name: 'Give' }))
    await expect(args.onGive).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }))
    await expect(args.onDuplicate).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    await expect(args.onDelete).toHaveBeenCalledOnce()
  },
}

/** Open, without notes: just the actions. */
export const NoNotes: Story = {
  args: { item: sword, expanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('term')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Give' })).toBeVisible()
  },
}

/** A stack of consumables shows how many are in it. */
export const Consumable: Story = {
  args: { item: byId('story-item-lantern-oil') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Lantern oil/ })).toHaveTextContent(/×3.*2 s/)
  },
}

/** Armor shows its value. */
export const Armor: Story = {
  args: { item: byId('story-item-leather') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Leather jerkin/ })).toHaveTextContent('+1 arm.')
  },
}

/** Nothing to show next to the name: the row is just its name. */
export const NoChips: Story = {
  args: { item: byId('story-item-map') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Smuggler map' })).toBeVisible()
  },
}

/** A long name is cut short on a phone; the chips wrap onto their own line. */
export const LongName: Story = {
  args: { item: { ...sword, name: 'Longsword of the Blackwater marshes, forged for the iron crown of the drowned king' } },
}
