import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'
import EmptyState from './EmptyState.vue'
import IconDice from './icons/IconDice.vue'

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    title: 'No items yet',
    hint: 'Add the loot, gear and treasures of your game, then hand them to characters.',
  },
  decorators: [() => ({ template: '<div style="max-width: 480px"><story /></div>' })],
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TitleOnly: Story = {
  args: { hint: undefined },
}

export const WithAction: Story = {
  render: (args) => ({
    components: { EmptyState, Button },
    setup: () => ({ args }),
    template: `<EmptyState v-bind="args"><Button variant="primary" size="sm">New item</Button></EmptyState>`,
  }),
}

/** One line in the box, for an empty list inside a panel or a sheet. */
export const HintOnly: Story = {
  args: { title: undefined, hint: 'The backpack is empty.' },
}

/** No frame and larger text, with an icon: a screen or panel with nothing else to show. */
export const Plain: Story = {
  args: { variant: 'plain', title: 'No characters yet', hint: 'Create one to start playing.' },
  render: (args) => ({
    components: { EmptyState, IconDice },
    setup: () => ({ args }),
    template: `<EmptyState v-bind="args"><template #icon><IconDice /></template></EmptyState>`,
  }),
}
