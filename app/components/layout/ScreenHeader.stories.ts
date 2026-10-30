import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import Button from '@/components/ui/Button.vue'
import ScreenHeader from './ScreenHeader.vue'

const meta = {
  title: 'Layout/ScreenHeader',
  component: ScreenHeader,
  args: { title: 'Item library', subtitle: 'The Crookhollow Expedition' },
  render: (args) => ({
    components: { ScreenHeader, Button },
    setup: () => ({ args }),
    template: `
      <ScreenHeader v-bind="args">
        <template #actions><Button variant="ghost" size="sm">Back to the table</Button></template>
      </ScreenHeader>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 640px"><story /></div>' })],
} satisfies Meta<typeof ScreenHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 1, name: 'Item library' })).toBeVisible()
  },
}

export const TitleOnly: Story = {
  args: { subtitle: undefined },
}

/** A long subtitle is cut short, the action keeps its place. */
export const LongSubtitle: Story = {
  args: { subtitle: 'The Very Long and Winding Expedition into the Caverns beneath Crookhollow Hill' },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
}
