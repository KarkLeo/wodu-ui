import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import InventoryPanel from './InventoryPanel.vue'
import { brann, CROOKHOLLOW_META, crookhollow, itemRows, ITEMS, mirel, OLDEN_META, olden, sage, wren } from '@/stories/fixtures'
import { withGameTable, withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useCharactersStore } from '@/stores/characters'
import { useLibraryStore } from '@/stores/library'
import { resetRecords } from '../../../../.storybook/mocks/pb'
import { asTeammate, expectNoEditControls, sheetFor } from '@/stories/readonly'

const meta = {
  title: 'Panels/InventoryPanel',
  component: InventoryPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren, mirel, sage] })],
} satisfies Meta<typeof InventoryPanel>

export default meta
type Story = StoryObj<typeof InventoryPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { InventoryPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    return { char, dispatch }
  },
  template: '<InventoryPanel v-if="char" :char="char" :dispatch="dispatch" />',
})

const body = () => within(document.body)
// The exact set of toolbar buttons: a loose text check would also pass when the toolbar is missing.
const toolbar = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll('.inv-toolbar button')).map(b => b.textContent?.trim())
const TABLE = [brann, wren, mirel, sage]

export const EquippedGear: Story = {
  render: forCharacter(brann.id),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: 'Catalog' })).toBeVisible()
    await expect(toolbar(canvasElement)).toEqual(['Catalog'])
  },
}

export const Empty: Story = {
  render: forCharacter(sage.id),
}

export const Quicksilver: Story = {
  render: forCharacter(mirel.id),
}

export const MultipleWeapons: Story = {
  render: forCharacter(wren.id),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bow = canvas.getByText('Shortbow').closest<HTMLElement>('.inv-item')!
    await userEvent.click(within(bow).getByRole('button', { name: 'Equip' }))
    await expect(await canvas.findByText('Multiple weapons equipped.')).toBeVisible()
  },
}

export const CatalogOpen: Story = {
  render: forCharacter(brann.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    await expect(await body().findByText('Gear catalog')).toBeVisible()
  },
}

export const AskTheGm: Story = {
  render: forCharacter(sage.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    const [ask] = await body().findAllByRole('button', { name: 'Ask' })
    await userEvent.click(ask!)
    await expect(await body().findByText('Not enough coins')).toBeVisible()
  },
}

/** A teammate's gear: items and their stats stay; no equip, use, remove or catalog. */
export const ReadOnly: Story = {
  render: forCharacter(brann.id),
  decorators: [sheetFor(brann.id), asTeammate([brann])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Rope (20ft)')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

/** A teammate's quicksilver: no "Use" that would drink it or open the overdose roll. */
export const ReadOnlyQuicksilver: Story = {
  render: forCharacter(mirel.id),
  decorators: [sheetFor(mirel.id), asTeammate([mirel])],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Quicksilver (dose)')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

/** A player at a table with a master hands out nothing and buys nothing: no toolbar, the gear still works. */
export const OwnerInGameWithMaster: Story = {
  render: forCharacter(wren.id),
  decorators: [withGameTable(olden, TABLE, OLDEN_META), sheetFor(wren.id)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bow = (await canvas.findByText('Shortbow')).closest<HTMLElement>('.inv-item')!
    await expect(canvasElement.querySelector('.inv-toolbar')).toBeNull()
    await userEvent.click(within(bow).getByRole('button', { name: 'Equip' }))
    await expect(await canvas.findByText('Multiple weapons equipped.')).toBeVisible()
    await userEvent.click(within(canvas.getByText('Lockpicks').closest<HTMLElement>('.inv-item')!).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(canvas.queryByText('Lockpicks')).toBeNull())
  },
}

/** The master on a player's sheet: only From library. */
export const MasterOnPlayerSheet: Story = {
  render: forCharacter(wren.id),
  decorators: [withGameTable(crookhollow, TABLE, CROOKHOLLOW_META), sheetFor(wren.id)],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Shortbow')
    await expect(toolbar(canvasElement)).toEqual(['From library'])
  },
}

/** From library on a player's sheet hands the item to that character (game and character ids reach the pick sheet). */
export const MasterGivesFromSheet: Story = {
  render: forCharacter(wren.id),
  decorators: [
    withGameTable(crookhollow, TABLE, CROOKHOLLOW_META),
    sheetFor(wren.id),
    (story) => ({
      components: { story },
      setup() {
        resetRecords('items', itemRows(crookhollow, ITEMS))
        useLibraryStore().clearAll()
      },
      template: '<story />',
    }),
  ],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Shortbow')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'From library' }))
    const sheet = await body().findByRole('dialog', { name: 'From library' }).then(d => within(d))
    await sheet.findByRole('list', { name: 'From library' })
    const row = sheet.getAllByRole('listitem').find(li => li.querySelector('.lp-name')?.textContent?.trim() === 'Longsword')!
    await userEvent.click(within(row).getByRole('button', { name: 'Give' }))
    await waitFor(() => expect(row).toHaveTextContent('Given'))
    const given = useCharactersStore().getById(wren.id)!.inventory.filter(i => i.name === 'Longsword')
    await expect(given).toHaveLength(1)
  },
}

/** The master's own character in their game is treated like any other created character there. */
export const MasterOwnCharacter: Story = {
  render: forCharacter(brann.id),
  decorators: [withGameTable(crookhollow, TABLE, CROOKHOLLOW_META), sheetFor(brann.id)],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Rope (20ft)')
    await expect(toolbar(canvasElement)).toEqual(['From library'])
  },
}

/** A character outside any game keeps the catalog and the Ask the GM path. */
export const FreeCharacter: Story = {
  render: forCharacter(sage.id),
  decorators: [withGameTable(crookhollow, TABLE, CROOKHOLLOW_META), sheetFor(sage.id)],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Catalog' })).toBeVisible()
    await expect(toolbar(canvasElement)).toEqual(['Catalog'])
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    await expect((await body().findAllByRole('button', { name: 'Ask' })).length).toBeGreaterThan(0)
  },
}

/** A game whose master left behind has nobody to hand items out: the catalog is back. */
export const MasterlessGame: Story = {
  render: forCharacter(brann.id),
  decorators: [withGameTable({ ...crookhollow, master: '' }, TABLE, CROOKHOLLOW_META), sheetFor(brann.id)],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('button', { name: 'Catalog' })).toBeVisible()
    await expect(toolbar(canvasElement)).toEqual(['Catalog'])
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    await expect((await body().findAllByRole('button', { name: 'Ask' })).length).toBeGreaterThan(0)
  },
}
