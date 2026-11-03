import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import SectionLabel from './SectionLabel.vue'

const meta = {
  title: 'UI/SectionLabel',
  component: SectionLabel,
  args: { as: 'span', size: 'sm', tone: 'accent' },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    tone: { control: 'inline-radio', options: ['accent', 'neutral'] },
  },
  render: (args) => ({
    components: { SectionLabel },
    setup: () => ({ args }),
    template: '<SectionLabel v-bind="args">Abilities</SectionLabel>',
  }),
  parameters: {
    docs: { description: { component: 'The bare mono uppercase label of a block or a field group. `SectionHeader` and `KeyValueRow` use it for their labels.' } },
  },
} satisfies Meta<typeof SectionLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A field or a group of rows: invite code, drafts, the popover's modifier row. */
export const Neutral: Story = {
  args: { tone: 'neutral' },
}

/** The caption over a card or a panel: the players panel, the invite card. */
export const Medium: Story = {
  args: { size: 'md' },
}

/** A section that is a heading for assistive tech keeps its role. */
export const AsHeading: Story = {
  args: { as: 'h2', tone: 'neutral' },
  render: (args) => ({
    components: { SectionLabel },
    setup: () => ({ args }),
    template: '<SectionLabel v-bind="args">Members</SectionLabel>',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 2, name: 'Members' })).toBeVisible()
  },
}

export const Variants: Story = {
  render: () => ({
    components: { SectionLabel },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px">
        <SectionLabel>Accent · sm</SectionLabel>
        <SectionLabel tone="neutral">Neutral · sm</SectionLabel>
        <SectionLabel size="md">Accent · md</SectionLabel>
        <SectionLabel size="md" tone="neutral">Neutral · md</SectionLabel>
      </div>
    `,
  }),
}
