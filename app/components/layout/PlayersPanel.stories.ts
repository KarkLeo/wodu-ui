import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import PlayersPanel from './PlayersPanel.vue'
import {
  brann, wren, mirel, oda, sage, draftGear, PARTY,
  crookhollow, olden, MEMBERS, CROOKHOLLOW_META, OLDEN_META,
} from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, inLayout, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { mode } from '@/transport/mode'
import { pb, signInMock } from '../../../.storybook/mocks/pb'

// Same width GameLayout gives the left column; collapse and rail only exist above 960px.
const desktopColumn: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: 280px; height: 100%; display: flex"><story /></div>',
})

// Sets the mode directly rather than through enterMode(), so no session starts or stops, and restores it
// so it does not leak into the next story.
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
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof PlayersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const OneOpen: Story = {
  loaders: [atRoute(`/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: /anna@mail\.com/ })).toBeVisible()
    // The mode follows the address now: no online/offline switch in the footer.
    await expect(canvas.queryByRole('radio', { name: 'Online' })).toBeNull()
    await expect(canvas.queryByText('Offline characters', { exact: false })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Full state reset' })).toBeNull()
  },
}

export const TwoOpen: Story = {
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
}

export const NoneOpen: Story = {
  loaders: [atRoute('/games')],
}

export const NoCharacters: Story = {
  decorators: [withStores({ characters: [draftGear] })],
  loaders: [atRoute('/games')],
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
  loaders: [atRoute('/offline')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Offline', { selector: '.pr-offline-badge *' })).toBeVisible()
    await expect(canvas.queryByRole('radio', { name: 'Offline' })).toBeNull()
    await expect(canvas.getByText(/live only on this device/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: new RegExp(sage.name) })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: new RegExp(brann.name) })).toBeNull()
    await expect(canvas.queryByRole('button', { name: /anna@mail\.com/ })).toBeNull()
  },
}

export const OfflineInLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [offlineMode, withStores({ characters: [sage] }), inLayout(), desktopColumn],
  loaders: [atRoute('/offline')],
}

// ── In a game ───────────────────────────────────────────────────────────────

const crookhollowTable = withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)
const oldenTable = withGameTable(olden, [...PARTY, sage], OLDEN_META)

const row = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement).findByRole('button', { name: new RegExp(name) })

/** The master's view: the game in the head, its characters with their owners, mine marked "you". */
export const GameAsMaster: Story = {
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(crookhollow.name)).toBeVisible()
    await expect(canvas.getByText('master', { selector: '.pr-role' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Game menu' })).toBeVisible()
    await expect(await row(canvasElement, brann.name)).toHaveTextContent(/you ·/)
    await expect(await row(canvasElement, wren.name)).toHaveTextContent(/Kostya ·/)
    await expect(await row(canvasElement, mirel.name)).toHaveTextContent(/Yana ·/)
    // My free character and characters of other games are not at this table.
    await expect(canvas.queryByRole('button', { name: new RegExp(sage.name) })).toBeNull()
    await expect(canvas.queryByRole('button', { name: new RegExp(oda.name) })).toBeNull()
    await expect(canvas.queryByText('This game has no master')).toBeNull()
  },
}

/** A player's view of another master's game. */
export const GameAsPlayer: Story = {
  decorators: [oldenTable],
  loaders: [atRoute(`/games/${olden.id}/party/${oda.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(olden.name)).toBeVisible()
    await expect(canvas.getByText('player', { selector: '.pr-role' })).toBeVisible()
    await expect(await row(canvasElement, oda.name)).toHaveTextContent(/Seva ·/)
    await expect(await row(canvasElement, oda.name)).toHaveClass('is-active')
    await expect(await row(canvasElement, wren.name)).toHaveTextContent(/you ·/)
    await expect(canvas.queryByRole('button', { name: new RegExp(brann.name) })).toBeNull()
  },
}

/** Opening and closing sheets stays on the game's own party route. */
export const GameOpenAndClose: Story = {
  tags: ['no-visual'],
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await row(canvasElement, wren.name))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${wren.id}`))
    await userEvent.click(await row(canvasElement, brann.name))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${wren.id},${brann.id}`))
    await userEvent.click(await row(canvasElement, wren.name))
    await userEvent.click(await row(canvasElement, brann.name))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

/** "New" inside a game creates the draft in that game and opens the game's wizard. */
export const GameNewCharacter: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('characters'), 'create')
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'New character' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/new`))
    await expect(create).toHaveBeenCalledWith(expect.objectContaining({ game: crookhollow.id }))
  },
}

/** Outside games the panel lists only my free characters (online), and sheets open on the party route. */
export const FreeTable: Story = {
  tags: ['no-visual'],
  decorators: [withStores({
    characters: [...PARTY, sage],
    games: [crookhollow],
    members: MEMBERS.filter(m => m.game === crookhollow.id),
    meta: CROOKHOLLOW_META,
  })],
  loaders: [atRoute(`/party/${sage.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await row(canvasElement, sage.name)).toHaveClass('is-active')
    await expect(canvas.queryByRole('button', { name: new RegExp(brann.name) })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Game menu' })).toBeNull()
    await userEvent.click(await row(canvasElement, oda.name))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/party/${sage.id},${oda.id}`))
  },
}

/** Ruling: a character whose game this player no longer knows counts as free. */
export const UnknownGameCountsAsFree: Story = {
  decorators: [withStores({
    characters: [brann, sage],
    meta: { [brann.id]: { owner: 'user-mock', game: 'story-game-gone' } },
  })],
  loaders: [atRoute('/games')],
  play: async ({ canvasElement }) => {
    await expect(await row(canvasElement, brann.name)).toBeVisible()
    await expect(await row(canvasElement, sage.name)).toBeVisible()
  },
}

// Seva deleted their account: their membership and their characters (Oda) went with it.
const masterless = { ...olden, master: '' }
const masterlessTable = withGameTable(masterless, [brann, wren, mirel, sage], OLDEN_META, MEMBERS.filter(m => m.user !== 'user-seva'))

/** The master deleted their account: every member sees the notice and can claim the role. */
export const Masterless: Story = {
  decorators: [masterlessTable],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('This game has no master')).toBeVisible()
    await expect(canvas.queryByText('player', { selector: '.pr-role' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Become master' })).toBeVisible()
  },
}

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

export const MasterlessClaim: Story = {
  decorators: [masterlessTable],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Become master' }))
    const dialog = await body(canvasElement).findByRole('dialog', { name: 'Become the master?' })
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Become master' }))
    await expect(update).toHaveBeenCalledWith(olden.id, { master: 'user-mock' })
    await waitFor(() => expect(within(canvasElement).queryByText('This game has no master')).toBeNull())
    await expect(within(canvasElement).getByText('master', { selector: '.pr-role' })).toBeVisible()
  },
}

/** Review focus 2: another member confirmed first — a clear refusal, and the winner shows as master. */
export const MasterlessClaimTaken: Story = {
  decorators: [masterlessTable],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'getOne').mockResolvedValueOnce({
      id: olden.id, name: olden.name, master: 'user-kostya', invite_code: olden.inviteCode,
    } as never)
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Become master' }))
    const dialog = await body(canvasElement).findByRole('dialog', { name: 'Become the master?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Become master' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toContain('Another player became the master first.'))
    await expect(useGamesStore().byId(olden.id)?.master).toBe('user-kostya')
    await waitFor(() => expect(within(canvasElement).queryByText('This game has no master')).toBeNull())
    await expect(within(canvasElement).getByText('player', { selector: '.pr-role' })).toBeVisible()
  },
}

/** Review focus 1 / ruling: losing the game frees my characters there at once. */
export const LosingTheGameFreesMine: Story = {
  decorators: [crookhollowTable],
  loaders: [atRoute('/games')],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: new RegExp(brann.name) })).toBeNull()
    const update = spyOn(pb.collection('characters'), 'update')
    const { forgetGame } = await import('@/transport/games')
    forgetGame(crookhollow.id)
    await expect(useCharactersStore().metaOf(brann.id)?.game).toBe('')
    // The server may still hold Brann in a game I am no longer in, which would refuse every roll for him.
    await waitFor(() => expect(update).toHaveBeenCalledWith(brann.id, { game: '' }))
    await expect(await row(canvasElement, brann.name)).toBeVisible()
    // Other players' characters there are no longer readable and leave the store.
    await expect(useCharactersStore().getById(wren.id)).toBeUndefined()
  },
}

export const GameInLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [crookhollowTable, inLayout(), desktopColumn],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
}

export const GameRail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [crookhollowTable, inLayout({ left: true }), desktopColumn],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Players · 3')).toBeInTheDocument()
  },
}
