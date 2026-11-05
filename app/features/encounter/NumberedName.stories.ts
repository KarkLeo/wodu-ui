import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
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
    await expect(canvasElement.querySelector('.numbered-name')).toHaveTextContent('Goblin #2')
  },
}

/** A name cut short shows in full under the pointer. */
export const CutNameHasTooltip: Story = {
  tags: ['no-visual'],
  args: { label: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}` },
  play: async ({ canvasElement, args }) => {
    const name = canvasElement.querySelector<HTMLElement>('.numbered-name-parts')!
    await userEvent.hover(name)
    await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toHaveTextContent(args.label)
    await userEvent.unhover(name)
  },
}

/** A whole name has nothing to add. */
export const WholeNameHasNoTooltip: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('.numbered-name-parts')!
    await userEvent.hover(name)
    await new Promise(r => setTimeout(r, 450))
    await expect(within(canvasElement.ownerDocument.body).queryByRole('tooltip')).toBeNull()
    await userEvent.unhover(name)
  },
}

/** `plain`: whatever is around the name says it, so no second tooltip. */
export const PlainHasNoTooltip: Story = {
  tags: ['no-visual'],
  args: { label: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}`, plain: true },
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('.numbered-name-parts')!
    await userEvent.hover(name)
    await new Promise(r => setTimeout(r, 450))
    await expect(within(canvasElement.ownerDocument.body).queryByRole('tooltip')).toBeNull()
    await userEvent.unhover(name)
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
