import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'
import CharacterListView from './CharacterListView.vue'
import { brann, crookhollow, draftIdentity, draftTraining, inGame, MEMBERS, mirel, PARTY, sage, wren } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { bootstrapStatus } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { t } from '@/locales'

const meta = {
  title: 'Screens/CharacterList',
  component: CharacterListView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/')],
} satisfies Meta<typeof CharacterListView>

export default meta
type Story = StoryObj<typeof meta>

export const PartyWithDrafts: Story = {
  decorators: [withStores({ characters: [...PARTY, draftTraining, draftIdentity] })],
}

export const Empty: Story = {
  decorators: [withStores({ characters: [] })],
}

// Listed before withStores so that it runs after it and overrides the 'ready' status withStores sets.
// Sets the mode directly rather than through setMode(), so nothing is persisted.
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
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/'))
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
