import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import PlayersPanel from './PlayersPanel.vue'
import { brann, wren, mirel, sage, draftGear, PARTY } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, inLayout, withStores } from '@/stories/state'
import { mode } from '@/transport/mode'

// Same width GameLayout gives the left column; collapse and rail only exist above 960px.
const desktopColumn: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: 280px; height: 100%; display: flex"><story /></div>',
})

// Sets the mode directly rather than through setMode(), so the story neither persists it nor leaks it
// into the next story.
const offlineMode: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = mode.value
    mode.value = 'offline'
    onUnmounted(() => { mode.value = previous })
  },
  template: '<story />',
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('radio', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.queryByText('Offline characters', { exact: false })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Full state reset' })).toBeNull()
  },
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

/** Offline mode: its own list, the badge in the header and the "only on this device" hint. */
export const Offline: Story = {
  decorators: [offlineMode, withStores({ characters: [sage] })],
  loaders: [atRoute('/')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('radio', { name: 'Offline' })).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByText('Offline', { selector: '.pr-offline-badge *' })).toBeVisible()
    await expect(canvas.getByText(/live only on this device/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: new RegExp(sage.name) })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: new RegExp(brann.name) })).toBeNull()
  },
}

export const OfflineInLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [offlineMode, withStores({ characters: [sage] }), inLayout(), desktopColumn],
  loaders: [atRoute('/')],
}
