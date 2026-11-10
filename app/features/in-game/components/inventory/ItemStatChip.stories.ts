import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import ItemStatChip from './ItemStatChip.vue'
import InvItem from './InvItem.vue'
import EncounterCard from '@/features/encounter/EncounterCard.vue'
import EncounterPickRow from '@/features/encounter/EncounterPickRow.vue'
import MonsterRow from '@/features/monster-library/MonsterRow.vue'
import type { InventoryItem } from '@/types/character'
import { brann, mirel, itemId, ENCOUNTER_MONSTERS, MONSTERS } from '@/stories/fixtures'

const item = (char: typeof brann, templateId: string): InventoryItem =>
  char.inventory.find(i => i.id === itemId(char, templateId))!

const LABELS = { damage: '1d6+2', armor: 'armor 1', hp: '18 HP', qty: '×3', price: '10 c' } as const

const meta = {
  title: 'Panels/Inventory/ItemStatChip',
  component: ItemStatChip,
  args: { variant: 'damage' },
  argTypes: {
    variant: { control: 'inline-radio', options: Object.keys(LABELS) },
  },
  render: (args) => ({
    components: { ItemStatChip },
    setup: () => ({ args, LABELS }),
    template: '<ItemStatChip v-bind="args">{{ LABELS[args.variant] }}</ItemStatChip>',
  }),
  parameters: {
    docs: { description: { component: 'A stat beside an item or a monster: damage, armor, HP, a stack, a price. Filled with no visible border, so it does not read as a button. Armor and HP fill darker than the card: `info` and `danger-bright` fall under AA on any light tint of it.' } },
  },
} satisfies Meta<typeof ItemStatChip>

export default meta
type Story = StoryObj<typeof meta>

export const Damage: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1d6+2')).toBeVisible()
  },
}

export const Armor: Story = { args: { variant: 'armor' } }

export const Hp: Story = { args: { variant: 'hp' } }

/** A stack of consumables; the neutral tone. */
export const Quantity: Story = { args: { variant: 'qty' } }

export const Price: Story = { args: { variant: 'price' } }

/** Every variant on the two backgrounds the chips sit on: a row (surface) and an encounter card (elevated). */
export const AllOnCards: Story = {
  render: () => ({
    components: { ItemStatChip },
    setup: () => ({ LABELS }),
    template: `
      <div style="display: grid; gap: 12px; max-width: 420px">
        <div v-for="bg in ['bg-surface', 'bg-elevated']" :key="bg" :style="{ background: 'var(--vtt-' + bg + ')', padding: '12px', borderRadius: 'var(--r-md)', display: 'flex', gap: '8px', flexWrap: 'wrap' }">
          <ItemStatChip v-for="(label, variant) in LABELS" :key="variant" :variant="variant">{{ label }}</ItemStatChip>
        </div>
      </div>`,
  }),
}

const sword = item(brann, 'battle_weapon')
const quicksilver = { ...item(mirel, 'mercury'), quantity: 3 }
const ogre = ENCOUNTER_MONSTERS[2]!
const deadWolf = { ...ENCOUNTER_MONSTERS[3]!, n: 3 }
const { diedAt: _, ...wolf } = { ...deadWolf, id: 'story-enc-wolf-2', n: 2, hp: 6 }

/** Where the chips live: an equipped weapon, a stack, encounter cards (one defeated), the picker beside its Add button and a library row. */
export const InContext: Story = {
  render: () => ({
    components: { InvItem, EncounterCard, EncounterPickRow, MonsterRow },
    setup: () => ({ sword, quicksilver, ogre, wolf, deadWolf, picks: [MONSTERS[0]!, MONSTERS[3]!], libraryRow: MONSTERS[0]! }),
    template: `
      <div style="display: grid; gap: 12px; max-width: 420px">
        <InvItem :item="sword" />
        <InvItem :item="quicksilver" />
        <div style="display: grid; gap: 8px; padding: 8px; background: var(--vtt-bg-surface); border-radius: var(--r-md)">
          <EncounterCard :monster="ogre" :selected="false" sort-mode="auto" />
          <EncounterCard :monster="wolf" :selected="false" sort-mode="auto" />
          <EncounterCard :monster="deadWolf" :selected="false" sort-mode="auto" />
        </div>
        <ul style="margin: 0; padding: 0; list-style: none; display: grid; gap: 8px">
          <EncounterPickRow v-for="m in picks" :key="m.id" :monster="m" :count="0" />
        </ul>
        <ul style="margin: 0; padding: 0; list-style: none">
          <MonsterRow :monster="libraryRow" :expanded="false" />
        </ul>
      </div>`,
  }),
}
