import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import EncounterPickSheet from './EncounterPickSheet.vue'
import { crookhollow, CROOKHOLLOW_META, monsterRows, MONSTERS, PARTY } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { emptyEncounter } from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { useLibraryStore } from '@/stores/library'
import { useToastsStore } from '@/stores/toasts'
import type { EncounterMonster } from '@/types/encounter'
import { pb, resetRecords } from '../../../.storybook/mocks/pb'

/** An empty open encounter and the game's monsters on the (mock) server; the library store starts empty. */
const withEncounter: Decorator = (story) => ({
  components: { story },
  setup() {
    resetRecords('monsters', monsterRows(crookhollow, MONSTERS))
    resetRecords('encounter_monsters', [])
    useLibraryStore().clearAll()
    const store = useEncounterStore()
    store.clearAll()
    store.setAll(crookhollow.id, emptyEncounter(crookhollow.id), [], [])
    useToastsStore().clearAll()
  },
  template: '<story />',
})

const meta = {
  title: 'Encounter/EncounterPickSheet',
  component: EncounterPickSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, gameId: crookhollow.id, 'onUpdate:open': fn() },
  decorators: [withEncounter, withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
} satisfies Meta<typeof EncounterPickSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Add a monster' }).then(d => within(d))
const rowOf = (list: HTMLElement, name: string) =>
  within(list).getAllByRole('listitem').find(li => li.querySelector('.ep-name')?.textContent?.trim() === name)!
const rowNames = (list: HTMLElement) => within(list).getAllByRole('listitem').map(li => li.querySelector('.ep-name')?.textContent)
const created = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(c => (c[0] as { data: EncounterMonster }).data)

/** The game's own monsters first, then the read-only starter set. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const own = await sheet.findByRole('list', { name: 'Your monsters' })
    await expect(rowNames(own)).toEqual(['Cultist of the Drowned God', 'Goblin', 'Ogre', 'Wolf'])
    await expect(sheet.getByRole('list', { name: 'Starter set' })).toBeVisible()
  },
}

/** Add can be pressed again and again: the sheet stays open and counts the presses. */
export const AddsRepeatedly: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const create = spyOn(pb.collection('encounter_monsters'), 'create')
    const sheet = await dialog(canvasElement)
    const own = await sheet.findByRole('list', { name: 'Your monsters' })
    const goblin = rowOf(own, 'Goblin')
    const add = within(goblin).getByRole('button', { name: 'Add' })
    await userEvent.click(add)
    await userEvent.click(add)
    await userEvent.click(add)
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3))
    await expect(created(create).map(m => m.n)).toEqual([1, 2, 3])
    await expect(created(create).every(m => m.sourceId === 'story-monster-goblin')).toBe(true)
    await expect(within(goblin).getByRole('status')).toHaveTextContent('3 added')
    await expect(args['onUpdate:open']).not.toHaveBeenCalled()
    await waitFor(() => expect(useEncounterStore().monsters).toHaveLength(3))
  },
}

/** A starter entry becomes an instance whose source is the starter id and whose name is in the current language. */
export const StarterEntry: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('encounter_monsters'), 'create')
    const sheet = await dialog(canvasElement)
    const starter = await sheet.findByRole('list', { name: 'Starter set' })
    await userEvent.click(within(rowOf(starter, 'Goblin')).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const monster = created(create)[0]!
    await expect(monster.sourceId).toBe('starter-goblin')
    await expect(monster.name).toBe('Goblin')
    await expect(monster.n).toBe(1)
  },
}

/** Search narrows both sections; no match says so. */
export const SearchFilters: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await sheet.findByRole('list', { name: 'Your monsters' })
    const box = sheet.getByRole('searchbox', { name: 'Search monsters' })
    await userEvent.type(box, 'ogre')
    await expect(rowNames(sheet.getByRole('list', { name: 'Your monsters' }))).toEqual(['Ogre'])
    await userEvent.clear(box)
    await userEvent.type(box, 'zzz')
    await expect(sheet.getByText('Nothing matches “zzz”.')).toBeVisible()
    await expect(sheet.queryByRole('list')).toBeNull()
  },
}

/** A failed load says so and offers Try again, instead of an empty list. */
export const LoadFailed: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        spyOn(pb.collection('monsters'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
      },
      template: '<story />',
    }),
    withEncounter,
    withGameTable(crookhollow, PARTY, CROOKHOLLOW_META),
  ],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t load the monsters.')
    await expect(sheet.queryByRole('list')).toBeNull()
    await userEvent.click(sheet.getByRole('button', { name: 'Try again' }))
    await expect(await sheet.findByRole('list', { name: 'Your monsters' })).toBeVisible()
  },
}

/** A refused write shows the save-failed toast; the press is still counted as sent. */
export const AddFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('encounter_monsters'), 'create').mockRejectedValue(new ClientResponseError({ status: 400 }))
    const sheet = await dialog(canvasElement)
    const own = await sheet.findByRole('list', { name: 'Your monsters' })
    await userEvent.click(within(rowOf(own, 'Ogre')).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toContain('Failed to save the monster. Check your connection.'))
    await expect(useEncounterStore().monsters).toHaveLength(0)
  },
}
