import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import PartyView from './PartyView.vue'
import { brann, wren, mirel, PARTY, crookhollow, CROOKHOLLOW_META } from '@/stories/fixtures'
import { atRoute, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useCharactersStore } from '@/stores/characters'
import { pb } from '../../../.storybook/mocks/pb'

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

// ── In a game ───────────────────────────────────────────────────────────────

const crookhollowTable = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const columns = (canvasElement: HTMLElement) => canvasElement.querySelectorAll('.sheet-column')
const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** The master's table: actions on their own character's column, none on a player's. */
export const GameSheets: Story = {
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: `Actions for ${brann.name}` })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: `Actions for ${wren.name}` })).toBeNull()
  },
}

/** Closing a sheet in a game stays on the game's table. */
export const GameCloseSheet: Story = {
  tags: ['no-visual'],
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const [first] = await canvas.findAllByRole('button', { name: 'Close sheet' })
    await userEvent.click(first!)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${wren.id}`))
    await userEvent.click(canvas.getByRole('button', { name: 'Close sheet' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

/** Taking my character out of the game closes its column. */
export const TakeOutClosesColumn: Story = {
  tags: ['no-visual'],
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    await userEvent.click(await within(canvasElement).findByRole('button', { name: `Actions for ${brann.name}` }))
    await userEvent.click(await body(canvasElement).findByRole('menuitem', { name: 'Take out of the game' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Take ${brann.name} out of the game?` }))
    await userEvent.click(confirm.getByRole('button', { name: 'Take out' }))
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(1))
    await expect(update).toHaveBeenCalledWith(brann.id, { game: '' })
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    // Nothing is left blocking the page once the confirmation went with the column.
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close sheet' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

/**
 * Review focus 5: a character leaves the game while its column is open (its owner took it out, left or
 * was removed): the column closes instead of offering writes that would fail.
 */
export const CharacterLeavesWhileOpen: Story = {
  tags: ['no-visual'],
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id},${mirel.id}`)],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    const characters = useCharactersStore()
    // Kostya took Wren out of the game (seen from Kostya's other session, or after a reload).
    characters.setMeta(wren.id, { owner: 'user-kostya', game: '' })
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(2))
    // Yana left the game: her characters are unreadable and dropped.
    characters.removeGameOthers(crookhollow.id, 'user-mock', 'user-yana')
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(1))
    await expect(within(canvasElement).getByRole('button', { name: `Actions for ${brann.name}` })).toBeVisible()
  },
}
