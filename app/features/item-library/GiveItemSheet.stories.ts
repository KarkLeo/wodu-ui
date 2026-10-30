import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import GiveItemSheet from './GiveItemSheet.vue'
import { crookhollow, CROOKHOLLOW_META, draftIdentity, inGame, ITEMS, PARTY, sage } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'

const sword = ITEMS.find(i => i.id === 'story-item-sword')!

const meta = {
  title: 'Library/GiveItemSheet',
  component: GiveItemSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, item: sword, gameId: crookhollow.id, 'onUpdate:open': fn() },
  decorators: [withGameTable(crookhollow, [...PARTY, sage, draftIdentity], { ...CROOKHOLLOW_META, [draftIdentity.id]: inGame(crookhollow) })],
} satisfies Meta<typeof GiveItemSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Give “Longsword”' }).then(d => within(d))

/** Every character of the game the master may edit, by name: no free character, no draft, no other game's. */
export const GiveSheet: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const rows = sheet.getAllByRole('button').filter(b => b.classList.contains('gs-row'))
    await expect(rows.map(r => r.querySelector('.gs-name')?.textContent)).toEqual(['Brann Ironhide', 'Mirel Vane', 'Wren Ashfoot'])
    await expect(rows[0]).toHaveTextContent('yours')
    await expect(rows[1]).toHaveTextContent('Yana')
    await expect(rows[2]).toHaveTextContent('Kostya')
    await expect(sheet.queryByText(sage.name)).toBeNull()
  },
}

/** Tapping a character gives the item and closes the sheet. */
export const GiveTap: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: /Wren Ashfoot/ }))
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false)
    const wren = useCharactersStore().getById('story-wren')!
    await expect(wren.inventory.filter(i => i.name === 'Longsword')).toHaveLength(1)
  },
}

/** A game with only unfinished characters has nobody to give to. */
export const Nobody: Story = {
  decorators: [withGameTable(crookhollow, [draftIdentity], { [draftIdentity.id]: inGame(crookhollow) })],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByText('No characters at this table to give it to.')).toBeVisible()
    await expect(sheet.queryAllByRole('button').filter(b => b.classList.contains('gs-row'))).toHaveLength(0)
  },
}
