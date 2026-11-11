import { provide, ref } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import MasterTools from './MasterTools.vue'
import { GameLayoutContextKey } from './gameLayoutContext'
import { crookhollow, CROOKHOLLOW_META, ENCOUNTER_MONSTERS, PARTY, sage } from '@/stories/fixtures'
import { atRoute, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useEncounterStore } from '@/stores/encounter'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { emptyStage, withScene } from '@/domain/stage'
import { clearPbRequests, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/MasterTools',
  component: MasterTools,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow },
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  render: (args) => ({
    components: { MasterTools },
    setup: () => ({ args }),
    template: '<div style="width: 280px; padding: 12px 6px"><MasterTools :game="args.game" /></div>',
  }),
  beforeEach() {
    signInMock()
    clearPbRequests()
  },
} satisfies Meta<typeof MasterTools>

export default meta
type Story = StoryObj<typeof meta>

const names = (group: HTMLElement) =>
  within(group).getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent?.trim())

/** The four rows of the master's tools, none of them active at the table. */
export const Default: Story = {
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('group', { name: 'Master' })
    await expect(names(group)).toEqual(['Encounter', 'Monsters', 'Items', 'Scenes'])
  },
}

const withLivingMonsters: Decorator = (story) => ({
  components: { story },
  setup() {
    const encounter = useEncounterStore()
    encounter.clearAll()
    encounter.startLoading(crookhollow.id)
    encounter.setAll(
      crookhollow.id,
      { id: 'story-state', sortMode: 'auto', manualOrder: [], counters: {} },
      structuredClone(ENCOUNTER_MONSTERS).filter(m => m.id !== 'story-enc-ogre-1'),
      [],
    )
  },
  template: '<story />',
})

/** Two living monsters and a dead one: the row's count is the living. */
export const EncounterCount: Story = {
  decorators: [withLivingMonsters],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('group', { name: 'Master' })
    await expect(canvas.getByRole('button', { name: 'Encounter, 2 in the fight' })).toBeVisible()
    await expect(within(group).getByText('2')).toBeVisible()
  },
}

/**
 * The gold bar sits 12px left of a selected row and the focus ring 4px around it; the scrolling block clips both unless
 * its padding box holds them.
 */
const barIsInsideTheScroller = async (row: HTMLElement) => {
  const scroller = row.closest('.mt-rows') as HTMLElement
  const rows = row.getBoundingClientRect()
  const box = scroller.getBoundingClientRect()
  await expect(rows.left - 12).toBeGreaterThanOrEqual(box.left)
  await expect(rows.left - 4).toBeGreaterThanOrEqual(box.left)
  await expect(rows.right + 4).toBeLessThanOrEqual(box.right)
  const first = scroller.firstElementChild!.getBoundingClientRect()
  const last = scroller.lastElementChild!.getBoundingClientRect()
  await expect(first.top - 4).toBeGreaterThanOrEqual(box.top)
  await expect(last.bottom + 4).toBeLessThanOrEqual(box.bottom)
}

// Listed before withLivingMonsters, which clears the store in its own setup.
const panelOpen: Decorator = (story) => ({
  components: { story },
  setup() {
    useEncounterStore().panelOpen = true
  },
  template: '<story />',
})

/** The panel is open: the Encounter row is pressed and carries the side bar of a selected row. */
export const EncounterOpen: Story = {
  decorators: [panelOpen, withLivingMonsters],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: 'Encounter, 2 in the fight' })
    await expect(row).toHaveAttribute('aria-pressed', 'true')
    await expect(within(row).getByText('2')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Monsters' })).not.toHaveAttribute('aria-current')
    await barIsInsideTheScroller(row)
  },
}

/** The row toggles the panel: a click turns it on and a second one off. */
export const EncounterToggles: Story = {
  tags: ['no-visual'],
  decorators: [withLivingMonsters],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: 'Encounter, 2 in the fight' })
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'false'))
  },
}

/** On the Monsters screen its row is the current page, with the same side bar. */
export const OnMonstersRoute: Story = {
  loaders: [atRoute(`/games/${crookhollow.id}/monsters`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'Monsters' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('button', { name: 'Items' })).not.toHaveAttribute('aria-current')
    await barIsInsideTheScroller(canvas.getByRole('button', { name: 'Monsters' }))
  },
}

export const OpensMonsters: Story = {
  tags: ['no-visual'],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Monsters' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/monsters`))
    await expect(canvas.getByRole('button', { name: 'Monsters' })).toHaveAttribute('aria-current', 'page')
  },
}

export const OpensItems: Story = {
  tags: ['no-visual'],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Items' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/items`))
    await expect(canvas.getByRole('button', { name: 'Items' })).toHaveAttribute('aria-current', 'page')
  },
}

/** On its own screen a library row goes back to the table. */
export const LibraryRowReturnsToTheTable: Story = {
  tags: ['no-visual'],
  loaders: [atRoute(`/games/${crookhollow.id}/monsters`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Monsters' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

const closeMobileOverlays = fn()
const inDrawer: Decorator = (story) => ({
  components: { story },
  setup() {
    closeMobileOverlays.mockClear()
    provide(GameLayoutContextKey, {
      leftCollapsed: ref(false),
      rightCollapsed: ref(false),
      toggleCollapsed: () => {},
      closeMobileOverlays,
    })
  },
  template: '<story />',
})

/** On a phone the players drawer would stay over the page the row opens. */
export const LibraryRowClosesTheDrawer: Story = {
  tags: ['no-visual'],
  decorators: [inDrawer],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Items' }))
    await expect(closeMobileOverlays).toHaveBeenCalled()
  },
}

const manyMonsters: Decorator = (story) => ({
  components: { story },
  setup() {
    const encounter = useEncounterStore()
    encounter.clearAll()
    encounter.startLoading(crookhollow.id)
    const base = ENCOUNTER_MONSTERS[0]!
    encounter.setAll(
      crookhollow.id,
      { id: 'story-state', sortMode: 'auto', manualOrder: [], counters: {} },
      Array.from({ length: 99 }, (_, i) => ({ ...base, id: `story-many-${i}`, n: i + 1 })),
      [],
    )
  },
  template: '<story />',
})

/** The longest copy (a two-digit count) stays on one line in every row, untruncated. */
const longLabels = async (canvasElement: HTMLElement, groupName: string) => {
  const group = await within(canvasElement).findByRole('group', { name: groupName })
  const rows = within(group).getAllByRole('button')
  await expect(rows).toHaveLength(4)
  await expect(within(group).getByText('99')).toBeVisible()
  const heights = rows.map(r => r.getBoundingClientRect().height)
  for (const row of rows) {
    const title = row.querySelector('.lr-title') as HTMLElement
    await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth)
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  }
  await expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
}

export const LongLabelsUk: Story = {
  globals: { locale: 'uk' },
  decorators: [manyMonsters],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: ({ canvasElement }) => longLabels(canvasElement, 'Майстер'),
}

export const LongLabelsRu: Story = {
  globals: { locale: 'ru' },
  decorators: [manyMonsters],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: ({ canvasElement }) => longLabels(canvasElement, 'Мастер'),
}

const scene = { id: 'story-scene-cellar', name: 'The flooded cellar and the long stair down to the drowned crypt below', image: null, sound: null }
const sceneOn: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(crookhollow.id)
    media.setScenes(crookhollow.id, [scene])
    useStageStore().set(withScene(emptyStage(crookhollow.id), scene))
  },
  template: '<story />',
})

const scenesCardClosed: Decorator = (story) => ({
  components: { story },
  setup() { useToolPanelsStore().clearAll() },
  template: '<story />',
})

/** The Scenes row after Items, not pressed while its card is closed and no scene is on. */
export const ScenesRowOff: Story = {
  decorators: [scenesCardClosed],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', { name: 'Scenes' })
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    await expect(row.querySelector('.lr-subtitle')).toBeNull()
  },
}

/** A scene is on: its name is the row's sub line (truncated, never squeezing the title) and the name says so. */
export const ScenesRowShowsTheActiveScene: Story = {
  decorators: [scenesCardClosed, sceneOn],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', { name: `Scenes, ${scene.name} is on` })
    const title = row.querySelector('.lr-title') as HTMLElement
    await expect(title).toHaveTextContent('Scenes')
    await expect(title.clientWidth).toBeGreaterThan(40)
    await expect(row.querySelector('.lr-subtitle')).toHaveTextContent(scene.name)
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  },
}

const sceneOnUnlisted: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(crookhollow.id)
    media.setScenes(crookhollow.id, [])
    useStageStore().set(withScene(emptyStage(crookhollow.id), scene))
  },
  template: '<story />',
})

const sceneOnListLoading: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(crookhollow.id)
    useStageStore().set(withScene(emptyStage(crookhollow.id), scene))
  },
  template: '<story />',
})

/** A scene deleted from the library while it is on: the row still says a scene is on. Its card is a separate thing. */
export const ScenesRowSceneNotInTheList: Story = {
  decorators: [scenesCardClosed, sceneOnUnlisted],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', { name: 'Scenes, a scene is on' })
    await expect(row.querySelector('.lr-subtitle')).toHaveTextContent('A scene is on')
    await expect(row).toHaveAttribute('aria-pressed', 'false')
  },
}

/** The list has not arrived yet: the same generic text, then the name once it is there. */
export const ScenesRowListStillLoading: Story = {
  decorators: [scenesCardClosed, sceneOnListLoading],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('button', { name: 'Scenes, a scene is on' })
    await expect(row.querySelector('.lr-subtitle')).toHaveTextContent('A scene is on')
    useMediaStore().setScenes(crookhollow.id, [scene])
    await expect(await canvas.findByRole('button', { name: `Scenes, ${scene.name} is on` })).toBeVisible()
  },
}

/** The row toggles the Scenes card on the table. */
export const ScenesRowToggles: Story = {
  tags: ['no-visual'],
  decorators: [scenesCardClosed],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const row = await within(canvasElement).findByRole('button', { name: 'Scenes' })
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'true'))
    await expect(useToolPanelsStore().open.scenes).toBe(true)
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('aria-pressed', 'false'))
  },
}

/** From a library screen the card would not show, so the row opens it and goes to the table. */
export const ScenesRowFromMonstersGoesToTheTable: Story = {
  tags: ['no-visual'],
  decorators: [scenesCardClosed],
  loaders: [atRoute(`/games/${crookhollow.id}/monsters`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Scenes' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
    await expect(useToolPanelsStore().open.scenes).toBe(true)
  },
}
