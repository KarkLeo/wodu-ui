import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import Pill from './Pill.vue'

const meta = {
  title: 'UI/Pill',
  component: Pill,
  args: { tone: 'neutral', size: 'md', dot: false },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'accent'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (args) => ({
    components: { Pill },
    setup: () => ({ args }),
    template: '<Pill v-bind="args">Player</Pill>',
  }),
  parameters: {
    docs: { description: { component: 'A small rounded mono label: a role (master, player, you), where a character is, the offline badge, a count. The text is cut with an ellipsis when the pill is given less room.' } },
  },
} satisfies Meta<typeof Pill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Player')).toBeVisible()
  },
}

/** The master's role, a free character. */
export const Accent: Story = {
  args: { tone: 'accent' },
  render: (args) => ({
    components: { Pill },
    setup: () => ({ args }),
    template: '<Pill v-bind="args">Master</Pill>',
  }),
}

/** Beside a caption, as the role in the players panel head. */
export const Small: Story = {
  args: { size: 'sm' },
}

/** The offline badge: a dot that is only decoration, so the text is the whole name. */
export const WithDot: Story = {
  args: { tone: 'accent', dot: true },
  render: (args) => ({
    components: { Pill },
    setup: () => ({ args }),
    template: '<Pill v-bind="args">Offline</Pill>',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Offline')).toBeVisible()
    await expect(canvasElement.querySelector('[aria-hidden="true"]')).not.toBeNull()
  },
}

/** A long text in a narrow place keeps one line. */
export const Truncated: Story = {
  render: (args) => ({
    components: { Pill },
    setup: () => ({ args }),
    template: '<div style="width: 120px; display: flex"><Pill v-bind="args">In game: Shadows over Crookhollow</Pill></div>',
  }),
}

export const Variants: Story = {
  render: () => ({
    components: { Pill },
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center">
        <Pill>Player</Pill>
        <Pill tone="accent">Master</Pill>
        <Pill size="sm">Player</Pill>
        <Pill size="sm" tone="accent">Master</Pill>
        <Pill tone="accent" dot>Offline</Pill>
        <Pill>3</Pill>
      </div>
    `,
  }),
}
