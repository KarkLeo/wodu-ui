import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import PlayersPanel from './PlayersPanel.vue'
import { brann, wren, mirel, sage, draftGear, PARTY } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, inLayout, withStores } from '@/stories/state'

// Same width GameLayout gives the left column; collapse and rail only exist above 960px.
const desktopColumn: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: 280px; height: 100%; display: flex"><story /></div>',
})

const meta = {
  title: 'Layout/PlayersPanel',
  component: PlayersPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="height: 100dvh; display: flex; flex-direction: column"><story /></div>' }),
    withStores({ characters: [...PARTY, sage, draftGear] }),
  ],
} satisfies Meta<typeof PlayersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const OneOpen: Story = {
  loaders: [atRoute(`/party/${brann.id}`)],
}

export const TwoOpen: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
}

export const NoneOpen: Story = {
  loaders: [atRoute('/')],
}

export const NoCharacters: Story = {
  decorators: [withStores({ characters: [draftGear] })],
  loaders: [atRoute('/')],
}

export const OpenAnother: Story = {
  loaders: [atRoute(`/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', { name: new RegExp(mirel.name) })
    await userEvent.click(row)
    await expect(row).toHaveClass('is-active')
  },
}

export const InLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [inLayout(), desktopColumn],
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
}

export const Rail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [inLayout({ left: true }), desktopColumn],
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
}

export const ResetConfirm: Story = {
  loaders: [atRoute(`/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Full state reset' }))
    await expect(await within(canvasElement.ownerDocument.body).findByRole('dialog')).toBeVisible()
  },
}
