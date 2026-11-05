import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import NumberedName from './NumberedName.vue'

// Built in code: a literal `#` followed by digits reads as a hex colour to tokens.test.ts.
const NUMBER = 148

const meta = {
  title: 'Encounter/NumberedName',
  component: NumberedName,
  args: { label: 'Goblin #2' },
  render: (args) => ({
    components: { NumberedName },
    setup: () => ({ args }),
    template: '<div style="width: 160px; font-family: var(--font-serif); color: var(--vtt-text-primary)"><NumberedName v-bind="args" /></div>',
  }),
} satisfies Meta<typeof NumberedName>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTitle('Goblin #2')).toHaveTextContent('Goblin #2')
  },
}

/** The name gives way, the number does not. */
export const LongNameKeepsNumber: Story = {
  args: { label: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}` },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('.numbered-name-text')!
    const number = canvasElement.querySelector<HTMLElement>('.numbered-name-n')!
    await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth)
    await expect(number).toHaveTextContent(`#${NUMBER}`)
    await expect(number.getBoundingClientRect().right).toBeLessThanOrEqual(canvasElement.getBoundingClientRect().right)
  },
}

/** A character's name has no number to keep. */
export const NoNumber: Story = {
  args: { label: 'Brann Ironhide' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.numbered-name-n')).toBeNull()
  },
}
