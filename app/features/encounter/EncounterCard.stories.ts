import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import EncounterCard from './EncounterCard.vue'
import { ENCOUNTER_MONSTERS } from '@/stories/fixtures'

const goblin = ENCOUNTER_MONSTERS[0]!
const goblin2 = ENCOUNTER_MONSTERS[1]!
const wolf = ENCOUNTER_MONSTERS[3]!

const meta = {
  title: 'Encounter/EncounterCard',
  component: EncounterCard,
  args: { monster: goblin, selected: false, expanded: false, sortMode: 'auto' },
  render: (args) => ({
    components: { EncounterCard },
    setup() {
      const expanded = ref(args.expanded)
      return { args, expanded }
    },
    template: '<div style="max-width: 420px"><EncounterCard v-bind="args" v-model:expanded="expanded" /></div>',
  }),
  parameters: {
    docs: { description: { component: 'A monster instance in the master’s encounter panel. The number sits outside the truncating name. A dead card is muted, cannot attack or be selected, and offers revive.' } },
  },
} satisfies Meta<typeof EncounterCard>

export default meta
type Story = StoryObj<typeof meta>

const card = (el: HTMLElement, name: string) => within(el).getByRole('article', { name })

export const Compact: Story = {
  play: async ({ canvasElement }) => {
    const c = within(card(canvasElement, 'Goblin #1'))
    await expect(c.getByText('#1')).toBeVisible()
    await expect(c.getByText('armor 0')).toBeVisible()
    await expect(c.getByText('1d6')).toBeVisible()
    await expect(c.getByRole('button', { name: 'Attack' })).toBeEnabled()
    await expect(c.getByRole('button', { name: 'Kill' })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Show details' })).toHaveAttribute('aria-expanded', 'false')
    await expect(c.queryByRole('button', { name: 'Edit' })).toBeNull()
  },
}

export const Expanded: Story = {
  args: { expanded: true },
  play: async ({ canvasElement }) => {
    const c = within(card(canvasElement, 'Goblin #1'))
    await expect(c.getByText('Cowardly: flees once half the pack is down.')).toBeVisible()
    await expect(c.getByText('Three of them hide in the mill loft.')).toBeVisible()
    await expect(c.getByRole('group', { name: 'Conditions' })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(c.getByRole('button', { name: 'Remove' })).toBeVisible()
    await userEvent.click(c.getByRole('button', { name: 'Hide details' }))
    await expect(c.queryByRole('button', { name: 'Edit' })).toBeNull()
  },
}

export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(card(canvasElement, 'Goblin #1')).getByRole('button', { name: /Goblin/ })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const Dead: Story = {
  args: { monster: wolf },
  play: async ({ canvasElement }) => {
    const c = within(card(canvasElement, 'Wolf #1'))
    await expect(c.getByRole('button', { name: 'Attack' })).toBeDisabled()
    await expect(c.getByRole('button', { name: 'Revive (1 HP)' })).toBeEnabled()
    await expect(c.queryByRole('button', { name: 'Kill' })).toBeNull()
    await expect(c.getByRole('button', { name: /Wolf/ })).toBeDisabled()
    await expect(getComputedStyle(card(canvasElement, 'Wolf #1')).opacity).toBe('0.55')
  },
}

// Built from a number: a literal hash followed by digits would read as a hex colour to tokens.test.ts.
const NUMBER = 148
const LONG = 'Chieftain of the Hollow Hills, Warden of the Seven Drowned Gates and Sworn Enemy of Travellers'.slice(0, 80)

/** A name this long is cut with an ellipsis; the number and the buttons stay inside the card. */
export const LongName: Story = {
  args: { monster: { ...goblin, name: LONG, n: NUMBER } },
  decorators: [(story) => ({ components: { story }, template: '<div style="width: 340px"><story /></div>' })],
  play: async ({ canvasElement }) => {
    await expect(LONG).toHaveLength(80)
    const root = card(canvasElement, `${LONG} #${NUMBER}`)
    const num = within(root).getByText(`#${NUMBER}`)
    const edge = root.getBoundingClientRect().right
    await expect(num.getBoundingClientRect().right).toBeLessThanOrEqual(edge)
    await expect(num.getBoundingClientRect().left).toBeGreaterThanOrEqual(root.getBoundingClientRect().left)
    for (const name of ['Attack', 'Kill', 'Show details']) {
      await expect(within(root).getByRole('button', { name }).getBoundingClientRect().right).toBeLessThanOrEqual(edge)
    }
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  },
}

export const WithConditions: Story = {
  args: { monster: goblin2 },
  play: async ({ canvasElement }) => {
    const c = within(card(canvasElement, 'Goblin #2'))
    await expect(c.getByText('Poisoned')).toBeVisible()
    await expect(c.getByText('Frightened')).toBeVisible()
  },
}

export const ManualGrip: Story = {
  args: { sortMode: 'manual' },
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.ec-grip')).not.toBeNull()
  },
}
