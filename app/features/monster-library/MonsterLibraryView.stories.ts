import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import MonsterLibraryView from './MonsterLibraryView.vue'
import { crookhollow, monsterRows, MONSTERS, olden, PARTY, sage, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useGamesStore } from '@/stores/games'
import { useLibraryStore } from '@/stores/library'
import { useToastsStore } from '@/stores/toasts'
import { connection } from '@/transport/connection'
import type { LibraryMonster } from '@/types/library'
import { pb, resetRecords } from '../../../.storybook/mocks/pb'

/** The game's monsters on the (mock) server, loaded by the screen itself as in the app. */
function withLibrary(monsters: LibraryMonster[] = MONSTERS): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetRecords('monsters', monsterRows(crookhollow, monsters))
      useLibraryStore().clearAll()
    },
    template: '<story />',
  })
}

// Runs the page's route re-check, as pages/games/[gameId]/monsters.vue does.
const recheck: Decorator = (story) => ({
  components: { story },
  setup() {
    useRouteRecheck()
  },
  template: '<story />',
})

const meta = {
  title: 'Screens/MonsterLibrary',
  component: MonsterLibraryView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  // Decorators run inside out: the library is seeded after the table (signed in, the game known).
  decorators: [withLibrary(), withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/monsters`)],
} satisfies Meta<typeof MonsterLibraryView>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const list = (canvasElement: HTMLElement) => within(within(canvasElement).getByRole('list', { name: 'Monster library' }))
// Each row is named by its title (aria-labelledby).
const rowName = (li: HTMLElement) => li.ownerDocument.getElementById(li.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()
const names = (canvasElement: HTMLElement) => list(canvasElement).getAllByRole('listitem').map(rowName)
const row = (canvasElement: HTMLElement, name: string) => list(canvasElement).getByRole('listitem', { name })
// The row's toggle, found by the monster's exact name (its accessible name also carries the stats).
const head = (canvasElement: HTMLElement, name: string) => within(row(canvasElement, name)).getAllByRole('button')[0]!
const sheet = (canvasElement: HTMLElement, name: string) => body(canvasElement).findByRole('dialog', { name }).then(d => within(d))
const loaded = (canvasElement: HTMLElement) => within(canvasElement).findByRole('list', { name: 'Monster library' })
const toastTexts = () => useToastsStore().items.map(t => t.text)

/** The master's library: every monster of the game, sorted by name, with its stat block. */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Monster library' })).toBeVisible()
    await expect(canvas.getByText(crookhollow.name)).toBeVisible()
    await loaded(canvasElement)
    await expect(names(canvasElement)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Ogre', 'Wolf'])
    await expect(head(canvasElement, 'Ogre')).toHaveTextContent(/18 HP.*armor 1.*1d10\+1/)
  },
}

export const AsMasterDesktop: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
  },
}

/** One row opens at a time; opening another closes the first. */
export const OpenRow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Goblin'))
    await expect(canvas.getByText('Three of them hide in the mill loft.')).toBeVisible()
    await userEvent.click(head(canvasElement, 'Wolf'))
    await expect(canvas.queryByText('Three of them hide in the mill loft.')).toBeNull()
    await expect(canvas.getByText('Hunts in packs near the old road.')).toBeVisible()
  },
}

/** The search looks at names, specials and notes; nothing found says so. */
export const Search: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    const search = canvas.getByRole('searchbox', { name: 'Search monsters' })
    await userEvent.type(search, 'pack')
    await expect(names(canvasElement)).toEqual(['Goblin', 'Wolf'])
    await userEvent.type(search, ' road')
    await expect(names(canvasElement)).toEqual(['Wolf'])
    await userEvent.clear(search)
    await userEvent.type(search, 'dragon')
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing matches “dragon”.')
    await userEvent.clear(search)
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search monsters' }), 'dragon')
  },
}

/** A new game's library: what to do next, and the button to do it. */
export const Empty: Story = {
  decorators: [withLibrary([])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No monsters yet.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'New monster' })).toBeVisible()
    await expect(canvas.queryByRole('list')).toBeNull()
  },
}

/** Adding writes the entry to the game's library; it shows up in the list, open. */
export const AddMonster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const create = spyOn(pb.collection('monsters'), 'create')
    await loaded(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New monster' }))
    const form = await sheet(canvasElement, 'New monster')
    await userEvent.type(form.getByLabelText('Name'), 'Bandit')
    await userEvent.type(form.getByLabelText('HP'), '5')
    await userEvent.type(form.getByLabelText('Damage'), 'd8')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const sent = create.mock.calls[0]![0] as { id: string; game: string; data: LibraryMonster }
    await expect(sent.game).toBe(crookhollow.id)
    await expect(sent.data).toEqual({ id: sent.id, name: 'Bandit', hp: 5, armor: 0, damage: '1d8' })
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await expect(names(canvasElement)).toEqual(['Bandit', 'Cultist of the Drowned God', 'Goblin', 'Ogre', 'Wolf'])
    await expect(head(canvasElement, 'Bandit')).toHaveAttribute('aria-expanded', 'true')
  },
}

/** Editing replaces the entry's data, never its game. */
export const EditMonster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const update = spyOn(pb.collection('monsters'), 'update')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Goblin'))
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    const form = await sheet(canvasElement, 'Edit monster')
    await userEvent.clear(form.getByLabelText('HP'))
    await userEvent.type(form.getByLabelText('HP'), '4')
    await userEvent.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith('story-monster-goblin', {
      data: { ...MONSTERS[1], hp: 4 },
    }))
    await waitFor(() => expect(head(canvasElement, 'Goblin')).toHaveTextContent('4 HP'))
  },
}

/** Duplicate makes a variant: a new entry with its own id, the original untouched. */
export const DuplicateMonster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const create = spyOn(pb.collection('monsters'), 'create')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Goblin'))
    await userEvent.click(canvas.getByRole('button', { name: 'Duplicate' }))
    const form = await sheet(canvasElement, 'New variant')
    await userEvent.clear(form.getByLabelText('Name'))
    await userEvent.type(form.getByLabelText('Name'), 'Goblin archer')
    await userEvent.clear(form.getByLabelText('Damage'))
    await userEvent.type(form.getByLabelText('Damage'), '1d6+1')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const sent = create.mock.calls[0]![0] as { id: string; data: LibraryMonster }
    await expect(sent.id).not.toBe('story-monster-goblin')
    await expect(sent.data).toMatchObject({ name: 'Goblin archer', hp: 3, damage: '1d6+1', notes: 'Three of them hide in the mill loft.' })
    await waitFor(() => expect(names(canvasElement)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Goblin archer', 'Ogre', 'Wolf']))
    await expect(head(canvasElement, 'Goblin')).toHaveTextContent('1d6')
  },
}

/** A refused save keeps the sheet open with what was typed, and adds nothing. */
export const SaveFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    spyOn(pb.collection('monsters'), 'create').mockRejectedValueOnce(new ClientResponseError({ status: 400 }))
    await loaded(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New monster' }))
    const form = await sheet(canvasElement, 'New monster')
    await userEvent.type(form.getByLabelText('Name'), 'Bandit')
    await userEvent.type(form.getByLabelText('HP'), '5')
    await userEvent.type(form.getByLabelText('Damage'), 'd8')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(form.getByRole('alert')).toHaveTextContent('Couldn’t save the monster. Try again.'))
    await expect(form.getByLabelText('Name')).toHaveValue('Bandit')
    // The open sheet hides the page from assistive tech; close it to read the list.
    await userEvent.click(form.getByRole('button', { name: 'Cancel' }))
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

/** Deleting asks first; confirmed, the entry is gone from the server and the list. */
export const DeleteMonster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const remove = spyOn(pb.collection('monsters'), 'delete')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Ogre'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Ogre”?')
    await expect(remove).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('story-monster-ogre'))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Wolf']))
  },
}

export const DeleteCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const remove = spyOn(pb.collection('monsters'), 'delete')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Ogre'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Ogre”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(remove).not.toHaveBeenCalled()
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

/** A refused delete keeps the entry, with the write-failure toast. */
export const DeleteFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    spyOn(pb.collection('monsters'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Ogre'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Ogre”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the monster. Try again.'))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

/** The entry was already deleted (another device): the server answers 404, I am still the master, so it counts as deleted. */
export const DeleteAlreadyGone: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('monsters'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 404 }))
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Ogre'))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Ogre”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Wolf']))
    await expect(toastTexts()).not.toContain('Couldn’t delete the monster. Try again.')
  },
}

/**
 * The role moved away and realtime has not said so yet: the 404 is the server refusing a non-master.
 * The game is re-read, the delete fails, and the new master in the store drops the library.
 */
export const DeleteAfterLosingMaster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('monsters'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 404 }))
    spyOn(pb.collection('games'), 'getOne').mockResolvedValueOnce({
      id: crookhollow.id, name: crookhollow.name, master: 'user-yana', invite_code: crookhollow.inviteCode, created: '',
    } as never)
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Ogre'))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Ogre”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the monster. Try again.'))
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe('user-yana')
    await expect(useLibraryStore().monsters).toEqual([])
  },
}

/** The store is cleared while the screen is still mounted (e.g. leaving for the offline table): it waits, never "Nothing matches". */
export const ClearedWhileOpen: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    useLibraryStore().clearAll()
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Loading…'))
    await expect(canvas.queryByText(/Nothing matches/)).toBeNull()
  },
}

/** Back from a server outage, the library is read again: the master's other device may have changed it. */
export const ReloadsAfterReconnect: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    resetRecords('monsters', monsterRows(crookhollow, MONSTERS.slice(1)))
    try {
      connection.value = 'down'
      await Promise.resolve()
      connection.value = 'ok'
      await waitFor(() => expect(names(canvasElement)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Wolf']))
    } finally {
      connection.value = 'ok'
    }
  },
}

/** A reload that fails keeps the list on screen, with a notice and a retry above it. */
export const ReloadFails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    spyOn(pb.collection('monsters'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    try {
      connection.value = 'down'
      await Promise.resolve()
      connection.value = 'ok'
      await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the monsters.')
    } finally {
      connection.value = 'ok'
    }
    await expect(names(canvasElement)).toHaveLength(4)
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull())
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

/** Entries that fail the shape check (or whose id does not match the record) are not shown. */
export const DropsBrokenEntries: Story = {
  tags: ['no-visual'],
  decorators: [(story) => ({
    components: { story },
    setup() {
      resetRecords('monsters', [
        ...monsterRows(crookhollow, MONSTERS.slice(0, 2)),
        { id: 'story-monster-broken', game: crookhollow.id, data: { id: 'story-monster-broken', name: 'Broken', hp: 0 } },
        { id: 'story-monster-other-id', game: crookhollow.id, data: { ...MONSTERS[2]!, id: 'someone-else' } },
        // Another game's entry never comes back from the filtered list.
        ...monsterRows(olden, [{ ...MONSTERS[3]!, id: 'story-monster-olden-wolf' }]),
      ])
    },
    template: '<story />',
  })],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    await expect(names(canvasElement)).toEqual(['Goblin', 'Ogre'])
  },
}

/** The library could not be loaded: say so, and let the master try again. */
export const LoadFails: Story = {
  loaders: [async () => {
    spyOn(pb.collection('monsters'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    return {}
  }],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the monsters.')
  },
}

export const LoadFailsThenRetry: Story = {
  tags: ['no-visual'],
  loaders: LoadFails.loaders,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('alert')
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await loaded(canvasElement)
    await expect(names(canvasElement)).toHaveLength(4)
  },
}

/** A deep link before the game is known shows the loading line and asks the server for nothing. */
export const Loading: Story = {
  decorators: [withGameTable({ ...crookhollow, id: 'story-game-unknown' }, [], {})],
  play: async ({ canvasElement }) => {
    const list = spyOn(pb.collection('monsters'), 'getFullList')
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading…')
    await expect(list).not.toHaveBeenCalled()
  },
}

/** A player who opens the library of a game they play in is sent to its table, and nothing is loaded. */
export const NonMasterRedirected: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck, withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}/monsters`)],
  play: async () => {
    const listCall = spyOn(pb.collection('monsters'), 'getFullList')
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}`))
    await expect(listCall).not.toHaveBeenCalled()
  },
}

/** The role moves away while the library is open (realtime, e.g. from another device): back to the table. */
export const LosesMasterWhileOpen: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    useGamesStore().upsertGame({ ...crookhollow, master: 'user-yana' })
    await expect(useLibraryStore().monsters).toEqual([])
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

/** Removed from the game (or the game deleted) while the library is open: home, with the usual toast. */
export const GameGoneWhileOpen: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    useGamesStore().removeGame(crookhollow.id)
    await expect(useLibraryStore().monsters).toEqual([])
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(toastTexts()).toContain('You’re no longer in that game.')
  },
}

export const Russian: Story = {
  globals: { locale: 'ru' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('list', { name: 'Библиотека монстров' })
  },
}
