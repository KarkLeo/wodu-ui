import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import PartyView from './PartyView.vue'
import { brann, wren, mirel, PARTY } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'

const meta = {
  title: 'Screens/Party',
  component: PartyView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: PARTY })],
} satisfies Meta<typeof PartyView>

export default meta
type Story = StoryObj<typeof meta>

export const TwoSheets: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
}

export const SingleSheet: Story = {
  loaders: [atRoute(`/party/${brann.id}`)],
}

export const ThreeSheets: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id},${mirel.id}`)],
}

export const SecondCard: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const dot = await within(canvasElement).findByRole('button', { name: 'Go to card 2' })
    await userEvent.click(dot)
  },
}

export const CloseSheet: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [first] = await canvas.findAllByRole('button', { name: 'Close sheet' })
    await userEvent.click(first!)
    await waitFor(() => expect(canvas.getAllByRole('button', { name: 'Close sheet' })).toHaveLength(1))
  },
}
