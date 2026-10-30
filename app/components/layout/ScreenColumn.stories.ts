import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ScreenColumn from './ScreenColumn.vue'
import ScreenHeader from './ScreenHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const meta = {
  title: 'Layout/ScreenColumn',
  component: ScreenColumn,
  parameters: { layout: 'fullscreen' },
  render: () => ({
    components: { ScreenColumn, ScreenHeader, EmptyState },
    template: `
      <ScreenColumn>
        <ScreenHeader title="Monster library" subtitle="The Crookhollow Expedition" />
        <EmptyState title="No monsters yet" hint="Add the creatures of your game to look them up at the table." />
      </ScreenColumn>
    `,
  }),
} satisfies Meta<typeof ScreenColumn>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Beside GameLayout's side panels the column stays clear of them. */
export const BesidePanels: Story = {
  decorators: [() => ({ template: '<div style="--gl-inset-left: 280px; --gl-inset-right: 120px"><story /></div>' })],
}
