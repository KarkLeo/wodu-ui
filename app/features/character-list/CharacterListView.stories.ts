import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CharacterListView from './CharacterListView.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import { brann, crookhollow, draftIdentity, draftTraining, inGame, MEMBERS, mirel, PARTY, sage, wren } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { bootstrapStatus } from '@/transport/bootstrap'
import { mode, setMode } from '@/transport/mode'
import { enterMode, startOfflineSession } from '@/transport/modeSwitch'
import { initialMode } from '@/utils/routeMode'
import { OFFLINE_KEYS } from '@/transport/offlineStorage'
import type { Character } from '@/types/character'
import { t } from '@/locales'
import { authStore, clearPbRequests, pbRequests, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/CharacterList',
  component: CharacterListView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/offline')],
} satisfies Meta<typeof CharacterListView>

export default meta
type Story = StoryObj<typeof meta>

// Listed before withStores so that it runs after it. Sets the mode directly, without the offline session.
const offlineMode: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = mode.value
    mode.value = 'offline'
    onUnmounted(() => {
      mode.value = previous
    })
  },
  template: '<story />',
})

/** The offline table (`/offline`) with no sheet open. */
export const PartyWithDrafts: Story = {
  decorators: [offlineMode, withStores({ characters: [...PARTY, draftTraining, draftIdentity] })],
}

export const Empty: Story = {
  decorators: [offlineMode, withStores({ characters: [] })],
}

/**
 * Starts the offline table with `characters` saved on the device while an account is signed in: `cold` as
 * the bootstrap plugin does when the app opens on /offline, `switch` as the mode middleware does on the way
 * there from the account. Leaves signed out, so returning to online loads nothing.
 */
function offlineSession(characters: Character[], how: 'cold' | 'switch'): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      signInMock()
      localStorage.setItem(OFFLINE_KEYS.characters, JSON.stringify(characters))
      clearPbRequests()
      if (how === 'cold') {
        setMode(initialMode('/offline'))
        startOfflineSession()
      } else {
        enterMode('offline')
      }
      onUnmounted(() => {
        authStore.clear()
        enterMode('online')
        for (const key of Object.values(OFFLINE_KEYS)) localStorage.removeItem(key)
      })
    },
    template: '<story />',
  })
}

const offlineTable = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  render: () => ({
    components: { PlayersPanel, CharacterListView },
    template: '<div style="display: flex; height: 100dvh"><PlayersPanel /><CharacterListView /></div>',
  }),
} satisfies Story

// Opens a sheet and changes the character: both stay on the device.
async function playAtTheOfflineTable(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await expect(mode.value).toBe('offline')
  await userEvent.click(await canvas.findByRole('button', { name: new RegExp(sage.name) }))
  await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/offline/party/${sage.id}`))
  useCharactersStore().dispatch(sage.id, { type: 'GAIN_XP', amount: 1 })
  await waitFor(() => expect(JSON.parse(localStorage.getItem(OFFLINE_KEYS.characters) ?? '[]')[0]?.xp).toBe(sage.xp + 1))
}

/** Opened on /offline: loading, opening a sheet and changing a character send nothing to PocketBase. */
export const OfflineTableSendsNothing: Story = {
  ...offlineTable,
  decorators: [offlineSession([sage], 'cold')],
  play: async ({ canvasElement }) => {
    await playAtTheOfflineTable(canvasElement)
    await expect(pbRequests()).toEqual([])
  },
}

/** Coming from the account: the only call is closing the account's realtime stream; the offline table adds none. */
export const EnteringOfflineSendsNothing: Story = {
  ...offlineTable,
  decorators: [offlineSession([sage], 'switch')],
  play: async ({ canvasElement }) => {
    await playAtTheOfflineTable(canvasElement)
    await expect(pbRequests()).toEqual(['realtime.unsubscribe'])
  },
}

// Listed before withStores so that it runs after it and overrides the 'ready' status withStores sets.
// Sets the mode directly rather than through enterMode(), so no session starts or stops.
const onlineLoading: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = { mode: mode.value, status: bootstrapStatus.value }
    mode.value = 'online'
    bootstrapStatus.value = 'loading'
    onUnmounted(() => {
      mode.value = previous.mode
      bootstrapStatus.value = previous.status
    })
  },
  template: '<story />',
})

/** Online data has not arrived yet (e.g. right after switching to Online): no empty state yet. */
export const LoadingOnline: Story = {
  decorators: [onlineLoading, withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    await expect(await view.findByRole('status')).toHaveTextContent(t('characterList.loading'))
    await expect(view.queryByText(t('characterList.empty.title'))).not.toBeInTheDocument()
  },
}

// The game table with no sheet open (route `game`): only that game's characters, and only my drafts there.
const crookhollowTable = withStores({
  characters: [brann, wren, mirel, sage, draftIdentity, draftTraining],
  games: [crookhollow],
  members: MEMBERS.filter(m => m.game === crookhollow.id),
  meta: {
    [brann.id]: inGame(crookhollow),
    [wren.id]: { owner: 'user-kostya', game: crookhollow.id },
    [draftIdentity.id]: inGame(crookhollow),
    [draftTraining.id]: { owner: 'user-kostya', game: crookhollow.id },
  },
  scope: { kind: 'game', gameId: crookhollow.id },
})

export const GameTable: Story = {
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    await expect(view.getByText('Pick a character in the left panel to open their sheet.')).toBeVisible()
    await expect(view.getAllByRole('button', { name: /Resume creation/ })).toHaveLength(1)
  },
}

export const GameTableEmpty: Story = {
  decorators: [withStores({
    characters: [sage],
    games: [crookhollow],
    members: MEMBERS.filter(m => m.game === crookhollow.id),
    scope: { kind: 'game', gameId: crookhollow.id },
  })],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No characters')).toBeVisible()
  },
}

// What pages/games/* run on top of the view.
const recheck: Decorator = (story) => ({
  components: { story },
  setup() {
    useRouteRecheck()
  },
  template: '<story />',
})

/** Review focus 1: removed from the game (or the game deleted) while its table is open → home, with a toast. */
export const RemovedWhileOpen: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async () => {
    await expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`)
    useGamesStore().removeGame(crookhollow.id)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(useToastsStore().items.map(t => t.text)).toContain('You’re no longer in that game.')
  },
}

/** A character that leaves the game drops out of an open game party; with none left, the table stays open. */
export const CharacterLeavesOpenParty: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async () => {
    const characters = useCharactersStore()
    characters.setMeta(wren.id, { owner: 'user-kostya', game: '' })
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${brann.id}`))
    characters.setMeta(brann.id, { owner: 'user-mock', game: '' })
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
    await expect(useToastsStore().items.map(t => t.text)).not.toContain('You’re no longer in that game.')
  },
}
