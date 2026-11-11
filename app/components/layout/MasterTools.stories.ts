import { provide } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import MasterTools from './MasterTools.vue'
import { GameLayoutContextKey } from './gameLayoutContext'
import { ref } from 'vue'
import { crookhollow, CROOKHOLLOW_META, ENCOUNTER_MONSTERS, PARTY, sage } from '@/stories/fixtures'
import { atRoute, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { currentLocale } from '@/locales'
import { useEncounterStore } from '@/stores/encounter'
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

/** The three rows of the master's tools, none of them active at the table. */
export const Default: Story = {
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('group', { name: 'Master' })
    await expect(names(group)).toEqual(['Encounter', 'Monsters', 'Items'])
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

const ukrainian: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = currentLocale.value
    currentLocale.value = 'uk'
    return { restore: () => { currentLocale.value = previous } }
  },
  unmounted() {
    this.restore()
  },
  template: '<story />',
})

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

/** The longest copy (Ukrainian, a two-digit count) stays on one line in every row. */
export const LongLabels: Story = {
  decorators: [manyMonsters, ukrainian],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const group = await within(canvasElement).findByRole('group', { name: 'Майстер' })
    const rows = within(group).getAllByRole('button')
    await expect(rows).toHaveLength(3)
    const heights = rows.map(r => r.getBoundingClientRect().height)
    for (const row of rows) await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    await expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
  },
}
