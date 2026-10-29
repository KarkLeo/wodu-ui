import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import ItemLibraryView from './ItemLibraryView.vue'
import { crookhollow, itemRows, ITEMS, olden, PARTY, sage, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useGamesStore } from '@/stores/games'
import { useLibraryStore } from '@/stores/library'
import { useToastsStore } from '@/stores/toasts'
import { connection } from '@/transport/connection'
import type { LibraryItem } from '@/types/library'
import { pb, resetRecords } from '../../../.storybook/mocks/pb'

/** The game's items on the (mock) server, loaded by the screen itself as in the app. */
function withLibrary(items: LibraryItem[] = ITEMS): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetRecords('items', itemRows(crookhollow, items))
      useLibraryStore().clearAll()
    },
    template: '<story />',
  })
}

// Runs the page's route re-check, as pages/games/[gameId]/items.vue does.
const recheck: Decorator = (story) => ({
  components: { story },
  setup() {
    useRouteRecheck()
  },
  template: '<story />',
})

const meta = {
  title: 'Screens/ItemLibrary',
  component: ItemLibraryView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  // Decorators run inside out: the library is seeded after the table (signed in, the game known).
  decorators: [withLibrary(), withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/items`)],
} satisfies Meta<typeof ItemLibraryView>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const list = (canvasElement: HTMLElement) => within(within(canvasElement).getByRole('list', { name: 'Item library' }))
const names = (canvasElement: HTMLElement) =>
  list(canvasElement).getAllByRole('listitem').map(li => li.querySelector('.ir-name')?.textContent?.trim())
// The row's toggle, found by the item's exact name (its accessible name also carries the stats).
const head = (canvasElement: HTMLElement, name: string) => {
  const row = list(canvasElement).getAllByRole('listitem').find(li => li.querySelector('.ir-name')?.textContent?.trim() === name)
  if (!row) throw new Error(`no row for ${name}`)
  return within(row).getAllByRole('button')[0]!
}
const sheet = (canvasElement: HTMLElement, name: string) => body(canvasElement).findByRole('dialog', { name }).then(d => within(d))
const loaded = (canvasElement: HTMLElement) => within(canvasElement).findByRole('list', { name: 'Item library' })
const ALL = ['Amulet of the Drowned God', 'Hunting crossbow', 'Lantern oil', 'Leather jerkin', 'Longsword', 'Oak shield', 'Smuggler map']
const toastTexts = () => useToastsStore().items.map(t => t.text)

/** The master's library: every item of the game, sorted by name, with its stat block. */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Item library' })).toBeVisible()
    await expect(canvas.getByText(crookhollow.name)).toBeVisible()
    await loaded(canvasElement)
    await expect(names(canvasElement)).toEqual(ALL)
    await expect(head(canvasElement, 'Longsword')).toHaveTextContent(/1d8.*melee.*40 s/)
    await expect(head(canvasElement, 'Lantern oil')).toHaveTextContent(/×3.*2 s/)
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
    await userEvent.click(head(canvasElement, 'Amulet of the Drowned God'))
    await expect(canvas.getByText('Cold to the touch; whispers near water.')).toBeVisible()
    await userEvent.click(head(canvasElement, 'Smuggler map'))
    await expect(canvas.queryByText('Cold to the touch; whispers near water.')).toBeNull()
    await expect(canvas.getByText('Marks three caves along the coast.')).toBeVisible()
  },
}

/** Picking a kind narrows the list to it, and works together with the search. */
export const KindFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    const filter = canvas.getByRole('radiogroup', { name: 'Kind' })
    await expect(within(filter).getAllByRole('radio').map(r => r.textContent?.trim())).toEqual(
      ['All', 'Weapons', 'Armor', 'Shields', 'Tools', 'Gear', 'Occult', 'Other'],
    )
    await userEvent.click(within(filter).getByRole('radio', { name: 'Weapons' }))
    await expect(names(canvasElement)).toEqual(['Hunting crossbow', 'Longsword'])
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search items' }), 'long')
    await expect(names(canvasElement)).toEqual(['Longsword'])
    await userEvent.clear(canvas.getByRole('searchbox', { name: 'Search items' }))
    await userEvent.click(within(filter).getByRole('radio', { name: 'Other' }))
    await expect(names(canvasElement)).toEqual(['Smuggler map'])
    await userEvent.click(within(filter).getByRole('radio', { name: 'Tools' }))
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing of this kind matches.')
    await userEvent.click(within(filter).getByRole('radio', { name: 'All' }))
    await expect(names(canvasElement)).toEqual(ALL)
  },
}

/** On a phone the kind bar scrolls inside itself; the page gets no sideways scroll. */
export const NoSidewaysScrollOnPhone: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    const doc = canvasElement.ownerDocument.documentElement
    await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth)
  },
}

/** The search looks at names and notes; nothing found says so. */
export const Search: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    const search = canvas.getByRole('searchbox', { name: 'Search items' })
    await userEvent.type(search, 'the')
    await expect(names(canvasElement)).toEqual(['Amulet of the Drowned God', 'Leather jerkin', 'Smuggler map'])
    await userEvent.type(search, ' coast')
    await expect(names(canvasElement)).toEqual(['Smuggler map'])
    await userEvent.clear(search)
    await userEvent.type(search, 'dragon')
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing matches “dragon”.')
    await userEvent.clear(search)
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search items' }), 'dragon')
  },
}

/** A new game's library: what to do next, and the button to do it. */
export const Empty: Story = {
  decorators: [withLibrary([])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No items yet.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'New item' })).toBeVisible()
    await expect(canvas.queryByRole('list')).toBeNull()
  },
}

/** Adding writes the entry to the game's library; it shows up in the list, open. */
export const AddItem: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const create = spyOn(pb.collection('items'), 'create')
    await loaded(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New item' }))
    const form = await sheet(canvasElement, 'New item')
    await userEvent.type(form.getByLabelText('Name'), 'Hand axe')
    await userEvent.type(form.getByLabelText('Damage'), 'd6')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const sent = create.mock.calls[0]![0] as { id: string; game: string; data: LibraryItem }
    await expect(sent.game).toBe(crookhollow.id)
    await expect(sent.data).toEqual({ id: sent.id, name: 'Hand axe', descriptor: { kind: 'weapon', melee: true }, damage: '1d6' })
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await expect(names(canvasElement)).toEqual([ALL[0], 'Hand axe', ...ALL.slice(1)])
    await expect(head(canvasElement, 'Hand axe')).toHaveAttribute('aria-expanded', 'true')
  },
}

/** Editing replaces the entry's data, never its game. */
export const EditItem: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const update = spyOn(pb.collection('items'), 'update')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Longsword'))
    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }))
    const form = await sheet(canvasElement, 'Edit item')
    await userEvent.clear(form.getByLabelText('Price'))
    await userEvent.type(form.getByLabelText('Price'), '45')
    await userEvent.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith('story-item-sword', {
      data: { ...ITEMS[3], price: 45 },
    }))
    await waitFor(() => expect(head(canvasElement, 'Longsword')).toHaveTextContent('45 s'))
  },
}

/** Copy makes a variant: a new entry with its own id, the original untouched. */
export const DuplicateItem: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const create = spyOn(pb.collection('items'), 'create')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Longsword'))
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }))
    const form = await sheet(canvasElement, 'New copy')
    await userEvent.clear(form.getByLabelText('Name'))
    await userEvent.type(form.getByLabelText('Name'), 'Shortsword')
    await userEvent.clear(form.getByLabelText('Damage'))
    await userEvent.type(form.getByLabelText('Damage'), '1d6')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const sent = create.mock.calls[0]![0] as { id: string; data: LibraryItem }
    await expect(sent.id).not.toBe('story-item-sword')
    await expect(sent.data).toMatchObject({ name: 'Shortsword', descriptor: { kind: 'weapon', melee: true }, damage: '1d6', price: 40 })
    await waitFor(() => expect(names(canvasElement)).toEqual([...ALL.slice(0, 6), 'Shortsword', 'Smuggler map']))
    await expect(head(canvasElement, 'Longsword')).toHaveTextContent('1d8')
  },
}

/** A refused save keeps the sheet open with what was typed, and adds nothing. */
export const SaveFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    spyOn(pb.collection('items'), 'create').mockRejectedValueOnce(new ClientResponseError({ status: 400 }))
    await loaded(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'New item' }))
    const form = await sheet(canvasElement, 'New item')
    await userEvent.type(form.getByLabelText('Name'), 'Hand axe')
    await userEvent.click(form.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(form.getByRole('alert')).toHaveTextContent('Couldn’t save the item. Try again.'))
    await expect(form.getByLabelText('Name')).toHaveValue('Hand axe')
    // The open sheet hides the page from assistive tech; close it to read the list.
    await userEvent.click(form.getByRole('button', { name: 'Cancel' }))
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

/** Deleting asks first; confirmed, the entry is gone from the server and the list. */
export const DeleteItem: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const remove = spyOn(pb.collection('items'), 'delete')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Oak shield'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Oak shield”?')
    await expect(remove).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('story-item-shield'))
    await waitFor(() => expect(names(canvasElement)).toEqual(ALL.filter(n => n !== 'Oak shield')))
  },
}

export const DeleteCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const remove = spyOn(pb.collection('items'), 'delete')
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Oak shield'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Oak shield”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(remove).not.toHaveBeenCalled()
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

/** A refused delete keeps the entry, with the write-failure toast. */
export const DeleteFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    spyOn(pb.collection('items'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Oak shield'))
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Oak shield”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the item. Try again.'))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

/** The entry was already deleted (another device): the server answers 404, I am still the master, so it counts as deleted. */
export const DeleteAlreadyGone: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('items'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 404 }))
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Oak shield'))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Oak shield”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(ALL.filter(n => n !== 'Oak shield')))
    await expect(toastTexts()).not.toContain('Couldn’t delete the item. Try again.')
  },
}

/**
 * The role moved away and realtime has not said so yet: the 404 is the server refusing a non-master.
 * The game is re-read, the delete fails, and the new master in the store drops the library.
 */
export const DeleteAfterLosingMaster: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('items'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 404 }))
    spyOn(pb.collection('games'), 'getOne').mockResolvedValueOnce({
      id: crookhollow.id, name: crookhollow.name, master: 'user-yana', invite_code: crookhollow.inviteCode, created: '',
    } as never)
    await loaded(canvasElement)
    await userEvent.click(head(canvasElement, 'Oak shield'))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete' }))
    const confirm = await sheet(canvasElement, 'Delete “Oak shield”?')
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the item. Try again.'))
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe('user-yana')
    await expect(useLibraryStore().items).toEqual([])
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
    resetRecords('items', itemRows(crookhollow, ITEMS.slice(1)))
    try {
      connection.value = 'down'
      await Promise.resolve()
      connection.value = 'ok'
      await waitFor(() => expect(names(canvasElement)).toEqual(ALL.filter(n => n !== 'Lantern oil')))
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
    spyOn(pb.collection('items'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    try {
      connection.value = 'down'
      await Promise.resolve()
      connection.value = 'ok'
      await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the items.')
    } finally {
      connection.value = 'ok'
    }
    await expect(names(canvasElement)).toHaveLength(7)
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull())
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

/** Entries that fail the shape check (or whose id does not match the record) are not shown. */
export const DropsBrokenEntries: Story = {
  tags: ['no-visual'],
  decorators: [(story) => ({
    components: { story },
    setup() {
      resetRecords('items', [
        ...itemRows(crookhollow, ITEMS.slice(0, 2)),
        { id: 'story-item-broken', game: crookhollow.id, data: { id: 'story-item-broken', name: 'Broken', descriptor: { kind: 'bogus' } } },
        { id: 'story-item-other-id', game: crookhollow.id, data: { ...ITEMS[2]!, id: 'someone-else' } },
        // Another game's entry never comes back from the filtered list.
        ...itemRows(olden, [{ ...ITEMS[3]!, id: 'story-item-olden-sword' }]),
      ])
    },
    template: '<story />',
  })],
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    await expect(names(canvasElement)).toEqual(['Hunting crossbow', 'Lantern oil'])
  },
}

/** The library could not be loaded: say so, and let the master try again. */
export const LoadFails: Story = {
  loaders: [async () => {
    spyOn(pb.collection('items'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    return {}
  }],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the items.')
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
    await expect(names(canvasElement)).toHaveLength(7)
  },
}

/** A deep link before the game is known shows the loading line and asks the server for nothing. */
export const Loading: Story = {
  decorators: [withGameTable({ ...crookhollow, id: 'story-game-unknown' }, [], {})],
  play: async ({ canvasElement }) => {
    const list = spyOn(pb.collection('items'), 'getFullList')
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading…')
    await expect(list).not.toHaveBeenCalled()
  },
}

/** A player who opens the library of a game they play in is sent to its table, and nothing is loaded. */
export const NonMasterRedirected: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck, withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}/items`)],
  play: async () => {
    const listCall = spyOn(pb.collection('items'), 'getFullList')
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
    await expect(useLibraryStore().items).toEqual([])
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
    await expect(useLibraryStore().items).toEqual([])
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(toastTexts()).toContain('You’re no longer in that game.')
  },
}

export const Russian: Story = {
  globals: { locale: 'ru' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('list', { name: 'Библиотека предметов' })
  },
}
