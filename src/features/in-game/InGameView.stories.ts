import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import InGameView from './InGameView.vue'
import { brann, wren, mirel, oda, sage, PARTY } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'

const meta = {
  title: 'Screens/InGame',
  component: InGameView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [...PARTY, sage] })],
} satisfies Meta<typeof InGameView>

export default meta
type Story = StoryObj<typeof meta>

const openTab = (name: string): Story['play'] => async ({ canvasElement }) => {
  const tab = await within(canvasElement).findByRole('tab', { name })
  await userEvent.click(tab)
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

export const Main: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
}

export const Wounded: Story = {
  args: { id: wren.id },
  loaders: [atRoute(`/character/${wren.id}`)],
}

export const ReadyToLevelUp: Story = {
  args: { id: oda.id },
  loaders: [atRoute(`/character/${oda.id}`)],
}

export const Inventory: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
  play: openTab('Inventory'),
}

export const EmptyInventory: Story = {
  args: { id: sage.id },
  loaders: [atRoute(`/character/${sage.id}`)],
  play: openTab('Inventory'),
}

export const Magic: Story = {
  args: { id: mirel.id },
  loaders: [atRoute(`/character/${mirel.id}`)],
  play: openTab('Magic'),
}

export const Notes: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
  play: openTab('Notes'),
}
