import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect } from 'storybook/test'
import ItemChips from './ItemChips.vue'
import { ITEMS } from '@/stories/fixtures'

const byId = (id: string) => ITEMS.find(i => i.id === id)!

const meta = {
  title: 'Library/ItemChips',
  component: ItemChips,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { item: byId('story-item-sword') },
} satisfies Meta<typeof ItemChips>

export default meta
type Story = StoryObj<typeof meta>

/** A weapon: damage, melee or ranged, price. */
export const Weapon: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/1d8.*melee.*40 s/)
  },
}

export const RangedWeapon: Story = {
  args: { item: byId('story-item-crossbow') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/1d6.*ranged.*30 s/)
  },
}

/** Light armor is +1, full +2. */
export const Armor: Story = {
  args: { item: byId('story-item-leather') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('+1 arm.')
    await expect(canvasElement).toHaveTextContent('20 s')
  },
}

export const FullArmor: Story = {
  args: { item: { id: 'x', name: 'Plate', descriptor: { kind: 'armor', class: 'full' } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('+2 arm.')
  },
}

/** Armor of class none has no armor value to show. */
export const NoArmorValue: Story = {
  args: { item: { id: 'x', name: 'Robe', descriptor: { kind: 'armor', class: 'none' } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).not.toHaveTextContent('arm.')
  },
}

export const Shield: Story = {
  args: { item: byId('story-item-shield') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('+1 arm.')
  },
}

/** A consumable shows how many come in the stack. */
export const Consumable: Story = {
  args: { item: byId('story-item-lantern-oil') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/×3.*2 s/)
  },
}

/** A consumable without a quantity counts as one. */
export const ConsumableWithoutQuantity: Story = {
  args: { item: { id: 'x', name: 'Torch', descriptor: { kind: 'gear', consumable: true } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('×1')
  },
}

/** Nothing to show: no chips at all. */
export const Bare: Story = {
  args: { item: byId('story-item-map') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent?.trim()).toBe('')
  },
}
