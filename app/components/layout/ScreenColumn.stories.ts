import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
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

/** As the page's main landmark (the cabinet column). */
export const AsMain: Story = {
  render: () => ({
    components: { ScreenColumn, ScreenHeader, EmptyState },
    template: `
      <ScreenColumn as="main">
        <ScreenHeader variant="eyebrow" title="Games" />
        <EmptyState title="No games yet" hint="Create one or join by an invite code." />
      </ScreenColumn>
    `,
  }),
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('main')
    await expect(within(main).getByRole('heading', { level: 1, name: 'Games' })).toBeVisible()
  },
}

/** A single card, narrower and set lower on the screen (the invite link). */
export const Narrow: Story = {
  render: () => ({
    components: { ScreenColumn, EmptyState },
    template: `
      <ScreenColumn size="narrow">
        <EmptyState title="Invite not valid" hint="Ask the master for a new link." />
      </ScreenColumn>
    `,
  }),
  play: async ({ canvasElement }) => {
    const column = canvasElement.querySelector('.screen-column') as HTMLElement
    await expect(column.getBoundingClientRect().width).toBeLessThanOrEqual(420)
  },
}
