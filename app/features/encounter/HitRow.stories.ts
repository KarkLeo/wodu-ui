import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect } from 'storybook/test'
import HitRow from './HitRow.vue'
import type { EncounterHit } from '@/types/encounter'

const hit: EncounterHit = {
  id: 'hit-1',
  rollId: 'roll-1',
  target: { kind: 'monster', id: 'story-enc-goblin-2', name: 'Goblin #2' },
  sourceName: 'Brann Ironhide',
  rollTotal: 6,
  armor: 0,
  amount: 6,
  at: 100,
}

const meta = {
  title: 'Encounter/HitRow',
  component: HitRow,
  args: { hit },
  render: (args) => ({
    components: { HitRow },
    setup: () => ({ args }),
    template: '<div style="width: 320px"><HitRow v-bind="args" /></div>',
  }),
} satisfies Meta<typeof HitRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.hit-row-target')).toHaveTextContent('Goblin #2')
    await expect(canvasElement.querySelector('.hit-row-source')).toHaveTextContent('Brann Ironhide')
    await expect(canvasElement.querySelector('.hit-row-calc')).toHaveTextContent('Roll 6 − armor 0')
    await expect(canvasElement.querySelector('.hit-row-amount')).toHaveTextContent('−6')
  },
}

/** The instance is gone from the panel; the hit keeps its name and numbers, and needs nothing from the store. */
export const RemovedMonster: Story = {
  args: { hit: { ...hit, target: { kind: 'monster', id: 'removed-long-ago', name: 'Troll #7' }, sourceName: 'Wren Ashfoot', rollTotal: 9, armor: 1, amount: 8 } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.hit-row-target')).toHaveTextContent('Troll #7')
    await expect(canvasElement.querySelector('.hit-row-calc')).toHaveTextContent('Roll 9 − armor 1')
    await expect(canvasElement.querySelector('.hit-row-amount')).toHaveTextContent('−8')
  },
}

/** A monster hitting a character: the source carries the number. */
export const FromMonster: Story = {
  args: { hit: { ...hit, target: { kind: 'character', id: 'story-brann', name: 'Brann Ironhide' }, sourceName: 'Ogre #1', rollTotal: 8, armor: 2, amount: 6 } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.hit-row-source')).toHaveTextContent('Ogre #1')
  },
}
