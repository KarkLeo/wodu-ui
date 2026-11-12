import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import PartyView from './PartyView.vue'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import { brann, wren, mirel, PARTY, crookhollow, CROOKHOLLOW_META, ENCOUNTER_MONSTERS } from '@/stories/fixtures'
import type { Decorator } from '@storybook/vue3-vite'
import { emptyEncounter } from '@/domain/encounter'
import { useTrayCards } from '@/composables/useTrayCards'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { useMediaStore } from '@/stores/media'
import { useEncounterStore } from '@/stores/encounter'
import { useGamesStore } from '@/stores/games'
import { atRoute, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useCharactersStore } from '@/stores/characters'
import { t } from '@/locales'
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

/** The master's table: the game actions on their own character's column, only Rename on a player's. */
export const GameSheets: Story = {
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: `Actions for ${brann.name}` })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: `Actions for ${wren.name}` }))
    const items = await body(canvasElement).findAllByRole('menuitem')
    await expect(items.map(i => i.textContent?.trim())).toEqual(['Rename'])
    await userEvent.keyboard('{Escape}')
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

/**
 * The master gives their character to a player from its column: the character stays at the table (now
 * Kostya's, so its actions go), and no dialog or overlay is left blocking the page.
 */
export const GiveFromColumn: Story = {
  tags: ['no-visual'],
  decorators: [crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    await userEvent.click(await within(canvasElement).findByRole('button', { name: `Actions for ${brann.name}` }))
    await userEvent.click(await body(canvasElement).findByRole('menuitem', { name: 'Give to a player' }))
    const sheet = within(await body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to a player` }))
    await userEvent.click(sheet.getByRole('button', { name: 'Kostya' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to Kostya?` }))
    await userEvent.click(confirm.getByRole('button', { name: 'Give' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(brann.id, { owner: 'user-kostya' }))
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe('none'))
    await expect(columns(canvasElement)).toHaveLength(2)
    // Kostya's now: the master may still rename it, but the game actions are gone.
    await userEvent.click(within(canvasElement).getByRole('button', { name: `Actions for ${brann.name}` }))
    const items = await body(canvasElement).findAllByRole('menuitem')
    await expect(items.map(i => i.textContent?.trim())).toEqual(['Rename'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body(canvasElement).queryByRole('menu')).toBeNull())
    const [first] = within(canvasElement).getAllByRole('button', { name: 'Close sheet' })
    await userEvent.click(first!)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${wren.id}`))
  },
}

// ── The encounter panel in the tray ─────────────────────────────────────────

/** The master's open encounter with its panel shown, as the game menu would leave the store. */
const withOpenPanel: Decorator = (story) => ({
  components: { story },
  setup() {
    const encounter = useEncounterStore()
    encounter.clearAll()
    encounter.setAll(crookhollow.id, emptyEncounter(crookhollow.id), structuredClone(ENCOUNTER_MONSTERS), [])
    encounter.panelOpen = true
  },
  template: '<story />',
})

const withEncounterClosed: Decorator = (story) => ({
  components: { story },
  setup() {
    const encounter = useEncounterStore()
    encounter.clearAll()
    encounter.setAll(crookhollow.id, emptyEncounter(crookhollow.id), structuredClone(ENCOUNTER_MONSTERS), [])
  },
  template: '<story />',
})

const withLeftoverMonster: Decorator = (story) => ({
  components: { story },
  setup() {
    const encounter = useEncounterStore()
    encounter.clearAll()
    encounter.setAll(crookhollow.id, emptyEncounter(crookhollow.id), structuredClone(ENCOUNTER_MONSTERS), [])
    encounter.selectMonster('story-enc-goblin-1')
  },
  template: '<story />',
})

/** The panel's column comes first, ahead of the sheets, and counts as a card of the carousel. */
export const EncounterColumnFirst: Story = {
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    await expect(within(columns(canvasElement)[0] as HTMLElement).getByRole('region', { name: 'Encounter' })).toBeVisible()
    await expect(within(columns(canvasElement)[1] as HTMLElement).queryByRole('region', { name: 'Encounter' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Go to card 3' })).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: 'Close sheet' })).toHaveLength(2)
  },
}

/** No sheet open on the game route: just the panel, no dots, and the active character is left alone. */
export const NoSheetOpen: Story = {
  tags: ['no-visual'],
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('region', { name: 'Encounter' })).toBeVisible()
    await expect(columns(canvasElement)).toHaveLength(1)
    await expect(canvasElement.querySelector('.party-dots')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Close sheet' })).toBeNull()
  },
}

export const ClosingThePanel: Story = {
  tags: ['no-visual'],
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Close encounter' }))
    await expect(useEncounterStore().panelOpen).toBe(false)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(1))
  },
}

/** A selected monster takes the highlight from the character, whose sheet stays active underneath. */
export const SelectingMonsterClearsCharacterHighlight: Story = {
  tags: ['no-visual'],
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const encounter = useEncounterStore()
    const characters = useCharactersStore()
    const canvas = within(canvasElement)
    await waitFor(() => expect(columns(canvasElement)[1]).toHaveClass('is-active'))
    const goblin = within(await canvas.findByRole('article', { name: 'Goblin #1' }))
    await userEvent.click(goblin.getByRole('button', { name: /Goblin/ }))
    await expect(encounter.selectedMonsterId).toBe('story-enc-goblin-1')
    await expect(columns(canvasElement)[1]).not.toHaveClass('is-active')
    await expect(characters.activeId).toBe(brann.id)
    await userEvent.click(goblin.getByRole('button', { name: /Goblin/ }))
    await expect(encounter.selectedMonsterId).toBeNull()
    await expect(columns(canvasElement)[1]).toHaveClass('is-active')
  },
}

/** Pressing a sheet selects its character and drops the monster. */
export const PressingSheetClearsMonster: Story = {
  tags: ['no-visual'],
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const encounter = useEncounterStore()
    const characters = useCharactersStore()
    await within(canvasElement).findByRole('article', { name: 'Goblin #1' })
    encounter.selectMonster('story-enc-goblin-1')
    await userEvent.pointer({ keys: '[MouseLeft>]', target: columns(canvasElement)[2] as HTMLElement })
    await userEvent.pointer({ keys: '[/MouseLeft]' })
    await expect(encounter.selectedMonsterId).toBeNull()
    await expect(characters.activeId).toBe(wren.id)
    await waitFor(() => expect(columns(canvasElement)[2]).toHaveClass('is-active'))
  },
}

/** On a phone, opened from a later sheet: the panel comes first in the carousel, and the carousel goes to it. */
export const OpeningFromLaterSheetShowsPanel: Story = {
  tags: ['no-visual'],
  decorators: [withEncounterClosed, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scroller = canvasElement.querySelector<HTMLElement>('.party-center')!
    await userEvent.click(await canvas.findByRole('button', { name: 'Go to card 2' }))
    await waitFor(() => expect(scroller.scrollLeft).toBeGreaterThan(0))
    useEncounterStore().togglePanel()
    const region = await canvas.findByRole('region', { name: 'Encounter' })
    const left = () => region.getBoundingClientRect().left - scroller.getBoundingClientRect().left
    // Once the scroll has settled: on the way there the panel can pass through the view and still end off-screen.
    await new Promise(r => setTimeout(r, 1200))
    await expect(Math.abs(left())).toBeLessThan(30)
  },
}

/** A monster left selected in a game does not take the highlight from a sheet at the free table. */
export const LeftoverMonsterKeepsHighlight: Story = {
  tags: ['no-visual'],
  decorators: [withLeftoverMonster],
  loaders: [atRoute(`/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    await expect(useEncounterStore().selectedMonsterId).toBe('story-enc-goblin-1')
    await waitFor(() => expect(columns(canvasElement)[0]).toHaveClass('is-active'))
  },
}

/**
 * The game page's two faces (`pages/games/[gameId]/index.vue`, which a story cannot render): the master loses the
 * game while the panel shows, and the panel goes at once, leaving the table's list.
 */
export const MasterLosesGameWhilePanelShows: Story = {
  tags: ['no-visual'],
  decorators: [withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  render: () => ({
    components: { PartyView, CharacterListView },
    setup: () => ({ showEncounter: useTrayCards().shown }),
    template: '<PartyView v-if="showEncounter" /><CharacterListView v-else />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const encounter = useEncounterStore()
    await expect(await canvas.findByRole('region', { name: 'Encounter' })).toBeVisible()
    await expect(canvasElement.querySelector('.party-center')).not.toBeNull()

    useGamesStore().upsertGame({ ...crookhollow, master: 'someone-else' })
    await waitFor(() => expect(canvas.queryByRole('region', { name: 'Encounter' })).toBeNull())
    await expect(encounter.panelOpen).toBe(false)
    await expect(encounter.monsters).toEqual([])
    await expect(canvasElement.querySelector('.party-center')).toBeNull()
    await expect(await canvas.findByText(t('characterList.pickFromSidebar'))).toBeVisible()
  },
}

const withScenesOpen: Decorator = (story) => ({
  components: { story },
  setup() {
    const panels = useToolPanelsStore()
    panels.clearAll()
    panels.toggle('scenes')
  },
  template: '<story />',
})

/** The master's cards come in the order of their rows, ahead of the sheets; each is a card of the carousel. */
export const MasterCardsInOrder: Story = {
  decorators: [withScenesOpen, withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    await expect(within(columns(canvasElement)[0] as HTMLElement).getByRole('region', { name: 'Encounter' })).toBeVisible()
    await expect(within(columns(canvasElement)[1] as HTMLElement).getByRole('heading', { name: 'Scenes' })).toBeVisible()
    await expect(canvasElement.querySelectorAll('.party-dot')).toHaveLength(3)
    await expect(canvas.getAllByRole('button', { name: 'Close sheet' })).toHaveLength(1)
  },
}

const withScenesAndSoundsOpen: Decorator = (story) => ({
  components: { story },
  setup() {
    const panels = useToolPanelsStore()
    panels.clearAll()
    panels.toggle('sounds')
    panels.toggle('scenes')
  },
  template: '<story />',
})

/** The Sounds card follows the Scenes card, whichever was opened first. */
export const SoundsCardFollowsScenes: Story = {
  tags: ['no-visual'],
  decorators: [withScenesAndSoundsOpen, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    await expect(within(columns(canvasElement)[0] as HTMLElement).getByRole('heading', { name: 'Scenes' })).toBeVisible()
    await expect(within(columns(canvasElement)[1] as HTMLElement).getByRole('heading', { name: 'Sounds' })).toBeVisible()
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close sounds' }))
    await expect(useToolPanelsStore().open.sounds).toBe(false)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(2))
  },
}

/** A card's own button closes it and leaves the others. */
export const ClosingAMasterCard: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Close scenes' }))
    await expect(useToolPanelsStore().open.scenes).toBe(false)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(2))
    await expect(canvas.getByRole('region', { name: 'Encounter' })).toBeVisible()
    await expect(canvasElement.querySelectorAll('.party-dot')).toHaveLength(2)
  },
}

/** The game page's gate: the Scenes card alone shows the tray, with no sheet and no encounter. */
export const ScenesCardAloneShowsTheTray: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  render: () => ({
    components: { PartyView, CharacterListView },
    setup: () => ({ shown: useTrayCards().shown }),
    template: '<PartyView v-if="shown" /><CharacterListView v-else />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('heading', { name: 'Scenes' })).toBeVisible()
    await expect(columns(canvasElement)).toHaveLength(1)
    await expect(canvasElement.querySelector('.party-dots')).toBeNull()
  },
}

/** Losing the game closes the master's cards with the rest, so a former master keeps none open. */
export const MasterCardsGoWithTheMaster: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  render: ScenesCardAloneShowsTheTray.render,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('heading', { name: 'Scenes' })).toBeVisible()
    useGamesStore().upsertGame({ ...crookhollow, master: 'someone-else' })
    await waitFor(() => expect(within(canvasElement).queryByRole('heading', { name: 'Scenes' })).toBeNull())
    await expect(useToolPanelsStore().open.scenes).toBe(false)
  },
}

/** The cards belong to one table: opening another game's table closes them, as the encounter panel does. */
export const MasterCardsCloseOnAnotherGame: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, withOpenPanel, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async () => {
    useMediaStore().startLoading(crookhollow.id, ['scenes'])
    useToolPanelsStore().toggle('scenes')
    useMediaStore().startLoading(crookhollow.id, ['scenes'])
    await expect(useToolPanelsStore().open.scenes).toBe(true)
    useMediaStore().startLoading('story-other-game', ['scenes'])
    await expect(useToolPanelsStore().open.scenes).toBe(false)
    useEncounterStore().startLoading('story-other-game')
    await expect(useEncounterStore().panelOpen).toBe(false)
  },
}

/** Another game's master changing leaves this table's cards open. */
export const MasterCardsKeepOnAnotherGamesMasterChange: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async () => {
    const games = useGamesStore()
    games.upsertGame({ ...crookhollow, id: 'story-other-game', master: 'a' })
    games.upsertGame({ ...crookhollow, id: 'story-other-game', master: 'b' })
    await expect(useToolPanelsStore().open.scenes).toBe(true)
    games.upsertGame({ ...crookhollow, master: 'someone-else' })
    await expect(useToolPanelsStore().open.scenes).toBe(false)
  },
}

/** The game leaves the store (the path `removeGame` takes): the cards close and the tray gives way to the list. */
export const MasterCardsGoWhenTheGameGoes: Story = {
  tags: ['no-visual'],
  decorators: [withScenesOpen, crookhollowTable],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  render: ScenesCardAloneShowsTheTray.render,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('heading', { name: 'Scenes' })).toBeVisible()
    useGamesStore().removeGame(crookhollow.id)
    await waitFor(() => expect(within(canvasElement).queryByRole('heading', { name: 'Scenes' })).toBeNull())
    await expect(useToolPanelsStore().open.scenes).toBe(false)
  },
}
