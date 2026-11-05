import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import LibraryPickSheet from './LibraryPickSheet.vue'
import { starterItems } from '@/domain/starterLibrary'
import { crookhollow, CROOKHOLLOW_META, itemRows, ITEMS, PARTY, sage } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { useLibraryStore } from '@/stores/library'
import { useToastsStore } from '@/stores/toasts'
import { clearPbRequests, pb, pbRequests, resetRecords } from '../../../../../.storybook/mocks/pb'
import { modalDocs } from '@/stories/docs'

/** The game's items on the (mock) server; the store starts empty, as before the library screen was ever opened. */
function withLibrary(items = ITEMS): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetRecords('items', itemRows(crookhollow, items))
      useLibraryStore().clearAll()
      clearPbRequests()
    },
    template: '<story />',
  })
}

const meta = {
  title: 'Panels/InventoryPanel/LibraryPickSheet',
  parameters: { docs: modalDocs },
  component: LibraryPickSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, gameId: crookhollow.id, characterId: 'story-wren', 'onUpdate:open': fn() },
  decorators: [withLibrary(), withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
} satisfies Meta<typeof LibraryPickSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'From library' }).then(d => within(d))
const rowOf = (sheet: { getAllByRole: (role: 'listitem') => HTMLElement[] }, name: string) =>
  sheet.getAllByRole('listitem').find(li => li.querySelector('.lp-name')?.textContent?.trim() === name)!

const rowNames = (sheet: { getAllByRole: (role: 'listitem') => HTMLElement[] }) =>
  sheet.getAllByRole('listitem').map(li => li.querySelector('.lp-name')?.textContent)

/** Opened before the library screen was ever visited: the sheet loads the items itself; the game's own come first, then the rulebook's. */
export const Loads: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(await sheet.findByRole('list', { name: 'From library' })).toBeVisible()
    await expect(pbRequests()).toContain('items.getFullList')
    await expect(sheet.getAllByRole('listitem')).toHaveLength(ITEMS.length + starterItems().length)
    await expect(rowNames(sheet)[0]).toBe('Amulet of the Drowned God')
    await expect(rowOf(sheet, 'Longsword')).toHaveTextContent(/1d8.*melee.*40 s/)
    await expect(sheet.getByRole('radio', { name: 'Weapons' })).toBeVisible()
  },
}

/** Search and the kind filter narrow the list. */
export const SearchAndFilter: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await sheet.findByRole('list', { name: 'From library' })
    await userEvent.click(sheet.getByRole('radio', { name: 'Weapons' }))
    await expect(rowNames(sheet).slice(0, 2)).toEqual(['Hunting crossbow', 'Longsword'])
    await userEvent.type(sheet.getByRole('searchbox', { name: 'Search items' }), 'longsword')
    await expect(rowNames(sheet)).toEqual(['Longsword'])
    await userEvent.clear(sheet.getByRole('searchbox', { name: 'Search items' }))
    await userEvent.type(sheet.getByRole('searchbox', { name: 'Search items' }), 'zzz')
    await expect(sheet.getByText('Nothing matches “zzz”.')).toBeVisible()
  },
}

/** A failed load says so and offers Try again, instead of an empty list. */
export const LoadFailed: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        spyOn(pb.collection('items'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
      },
      template: '<story />',
    }),
    withLibrary(),
    withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META),
  ],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t load the items.')
    await expect(sheet.queryByRole('list')).toBeNull()
    await userEvent.click(sheet.getByRole('button', { name: 'Try again' }))
    await expect(await sheet.findByRole('list', { name: 'From library' })).toBeVisible()
  },
}

/** A game with no items of its own still has the rulebook's to give; they stack with bought ones and keep the catalog item's name. */
export const NewGameGivesFromRulebook: Story = {
  decorators: [withLibrary([]), withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await sheet.findByRole('list', { name: 'From library' })
    await expect(sheet.getAllByRole('listitem')).toHaveLength(starterItems().length)
    await userEvent.click(within(rowOf(sheet, 'Quicksilver (dose)')).getByRole('button', { name: 'Give' }))
    await waitFor(() => expect(rowOf(sheet, 'Quicksilver (dose)')).toHaveTextContent('Given'))
    const given = useCharactersStore().getById('story-wren')!.inventory.find(i => i.templateId === 'mercury')
    await expect(given).toMatchObject({ name: '', descriptor: { kind: 'occult', consumable: true } })
    await expect(given?.libraryItemId).toBeUndefined()
  },
}

/** Two gives in a row: both land, the sheet stays open and each row says Given, with no toast on top. */
export const GiveTwoInARow: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement)
    await sheet.findByRole('list', { name: 'From library' })
    await userEvent.click(within(rowOf(sheet, 'Longsword')).getByRole('button', { name: 'Give' }))
    await userEvent.click(within(rowOf(sheet, 'Lantern oil')).getByRole('button', { name: 'Give' }))
    await waitFor(() => expect(rowOf(sheet, 'Lantern oil')).toHaveTextContent('Given'))
    await expect(rowOf(sheet, 'Longsword')).toHaveTextContent('Given')
    const wren = useCharactersStore().getById('story-wren')!
    await expect(wren.inventory.filter(i => i.name === 'Longsword')).toHaveLength(1)
    await expect(wren.inventory.filter(i => i.name === 'Lantern oil')).toHaveLength(1)
    await expect(args['onUpdate:open']).not.toHaveBeenCalledWith(false)
    const toastTexts = useToastsStore().items.map(t => t.text)
    await expect(toastTexts).not.toContain('Wren Ashfoot got Longsword.')
    await expect(toastTexts).not.toContain('Wren Ashfoot got Lantern oil.')
  },
}
