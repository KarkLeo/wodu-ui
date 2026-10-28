import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import MonsterRow from './MonsterRow.vue'
import { MONSTERS } from '@/stories/fixtures'

const [ogre, goblin, , wolf] = MONSTERS

const meta = {
  title: 'Library/MonsterRow',
  component: MonsterRow,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    monster: goblin!,
    expanded: false,
    'onUpdate:expanded': fn(),
    onEdit: fn(),
    onDuplicate: fn(),
    onDelete: fn(),
  },
  // A row is a list item; it lives in the screen's list.
  render: (args) => ({
    components: { MonsterRow },
    setup: () => ({ args }),
    template: '<ul style="margin: 0; padding: 0"><MonsterRow v-bind="args" /></ul>',
  }),
} satisfies Meta<typeof MonsterRow>

export default meta
type Story = StoryObj<typeof meta>

/** Closed: the name and the stat block (HP, armor, damage) the master looks up at the table. */
export const Closed: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const head = canvas.getByRole('button', { name: /Goblin/ })
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(head).toHaveTextContent('3 HP')
    await expect(head).toHaveTextContent('armor 0')
    await expect(head).toHaveTextContent('1d6')
    await expect(canvas.queryByRole('button', { name: 'Edit' })).toBeNull()
    await userEvent.click(head)
    await expect(args['onUpdate:expanded']).toHaveBeenCalledWith(true)
  },
}

/** Open: special and notes, then edit, duplicate and delete. */
export const Expanded: Story = {
  args: { expanded: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Goblin/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(canvas.getByText('Cowardly: flees once half the pack is down.')).toBeVisible()
    await expect(canvas.getByText('Three of them hide in the mill loft.')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Duplicate' }))
    await expect(args.onDuplicate).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    await expect(args.onDelete).toHaveBeenCalledOnce()
  },
}

/** Open, with only notes. */
export const NotesOnly: Story = {
  args: { monster: wolf!, expanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Special')).toBeNull()
    await expect(canvas.getByText('Hunts in packs near the old road.')).toBeVisible()
  },
}

/** Open, with neither special nor notes: just the actions. */
export const NoDetails: Story = {
  args: { monster: { ...ogre!, special: undefined }, expanded: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('term')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Duplicate' })).toBeVisible()
  },
}

/** A long name is cut short on a phone; the stats wrap onto their own line. */
export const LongName: Story = {
  args: { monster: { ...ogre!, name: 'Ogre chieftain of the Blackwater marshes, wearer of the iron crown', hp: 120, armor: 3, damage: '2d10+5' } },
}
