import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import GameLayout from './GameLayout.vue'
import PlayersPanel from './PlayersPanel.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { brann, wren, sage, PARTY, ROLLS, CHANGES, crookhollow, CROOKHOLLOW_META } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withGameTable, withStores } from '@/stories/state'

const PHONE = { viewport: { value: 'phone', isRotated: false } }

const meta = {
  title: 'Screens/Table',
  component: GameLayout,
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [...PARTY, sage], rolls: ROLLS, changes: CHANGES })],
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
  render: () => ({
    components: { GameLayout, PartyView, PlayersPanel, DiceDrawer },
    template: `
      <GameLayout>
        <PartyView />
        <template #left><PlayersPanel /></template>
        <template #right><DiceDrawer /></template>
      </GameLayout>
    `,
  }),
} satisfies Meta<typeof GameLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
}

export const DesktopSingleSheet: Story = {
  globals: DESKTOP_VIEWPORT,
  loaders: [atRoute(`/party/${brann.id}`)],
}

// Collapse buttons are display:none below 961px, which hides them from role queries; label queries still find them.
export const DesktopCollapsed: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const buttons = await canvas.findAllByLabelText('Collapse', { selector: 'button' })
    for (const button of buttons) await userEvent.click(button)
    await expect(canvas.getByText('Players · 5')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Log', { selector: 'button' })).toBeInTheDocument()
  },
}

export const Phone: Story = {
  globals: PHONE,
}

export const PhonePlayers: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Players' }))
  },
}

export const PhoneLog: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Dice' }))
  },
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Scrolls the sheet's content area and checks the header collapses and stays collapsed,
// the content keeps its scroll position and the header stays pinned above it.
async function scrollSheet(canvasElement: HTMLElement, by: number) {
  const content = canvasElement.querySelector<HTMLElement>('.app-shell-content')!
  const header = canvasElement.querySelector<HTMLElement>('.app-shell-header')!
  const headerTop = header.getBoundingClientRect().top
  content.scrollTop = by
  await settle(800)
  await expect(content.scrollTop).toBeGreaterThan(0)
  await expect(canvasElement.querySelector('.status-header.is-compact')).not.toBeNull()
  await expect(header.getBoundingClientRect().top).toBe(headerTop)
}

/** Wren's main tab overflows by less than the compact header saves: scrolling must not flicker back. */
export const PhoneScrollShortSheet: Story = {
  globals: PHONE,
  loaders: [atRoute(`/party/${wren.id}`)],
  play: async ({ canvasElement }) => scrollSheet(canvasElement, 30),
}

export const DesktopScrollSheet: Story = {
  globals: DESKTOP_VIEWPORT,
  loaders: [atRoute(`/party/${wren.id}`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('tab', { name: 'Inventory' }))
    await scrollSheet(canvasElement, 60)
  },
}

/** In a game the phone top bar is titled with the game's name. */
export const PhoneGame: Story = {
  globals: PHONE,
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const title = canvasElement.querySelector('.gl-mob-center-title .t')
    await expect(title).toHaveTextContent(crookhollow.name)
  },
}

export const PhoneGamePlayers: Story = {
  globals: PHONE,
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Players' }))
  },
}

export const DesktopGame: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
}
