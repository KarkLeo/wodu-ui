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
    onEdit: fn(),
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
    await expect(within(canvasElement).getByRole('button', { name: 'Edit' })).toBeVisible()
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
