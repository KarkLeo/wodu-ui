import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'
import InvItem from './InvItem.vue'
import type { InventoryItem } from '@/types/character'
import { brann, mirel, itemId } from '@/stories/fixtures'
import { expectNoEditControls, readonlySheet } from '@/stories/readonly'

const item = (char: typeof brann, templateId: string): InventoryItem =>
  char.inventory.find(i => i.id === itemId(char, templateId))!

const sword = item(brann, 'battle_weapon')
const rope = item(brann, 'rope')
const quicksilver = item(mirel, 'mercury')
const locket: InventoryItem = {
  id: 'story-locket',
  name: 'Silver locket',
  descriptor: { kind: 'custom' },
  price: 5,
  notes: 'A portrait of someone nobody recognises.',
}

const meta = {
  title: 'Panels/Inventory/InvItem',
  component: InvItem,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    item: sword,
    'onToggle-equip': fn(),
    onUse: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof InvItem>

export default meta
type Story = StoryObj<typeof meta>

export const EquippedWeapon: Story = {}

export const Gear: Story = {
  args: { item: rope },
}

export const Consumable: Story = {
  args: { item: quicksilver },
}

export const Custom: Story = {
  args: { item: locket },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Equip' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Edit' })).toBeNull()
  },
}

/** An own item stored before players lost the ability to create them: still usable, no edit. */
export const StoredOwnItem: Story = {
  args: { item: { ...locket, id: 'story-own-draught', name: 'Own draught', descriptor: { kind: 'custom', consumable: true }, quantity: 2 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Own draught')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Use' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Remove' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Edit' })).toBeNull()
  },
}

/** On a read-only sheet: name, notes and stats, no equip/use/edit/remove. */
export const ReadOnly: Story = {
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Martial weapon')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

export const ReadOnlyConsumable: Story = {
  args: { item: quicksilver },
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Quicksilver (dose)')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

export const ReadOnlyCustom: Story = {
  args: { item: locket },
  decorators: [readonlySheet],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Silver locket')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}
