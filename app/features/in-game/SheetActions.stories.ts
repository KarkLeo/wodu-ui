import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import SheetActions from './SheetActions.vue'
import { brann, crookhollow, mirel, oda, olden, PARTY, sage, wren, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable, withStores } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/InGame/SheetActions',
  component: SheetActions,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { characterId: brann.id },
  decorators: [
    withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META),
    (story) => ({ components: { story }, template: '<div style="display: flex; justify-content: flex-end; padding: 16px"><story /></div>' }),
  ],
} satisfies Meta<typeof SheetActions>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function openMenu(canvasElement: HTMLElement, name: string) {
  await userEvent.click(await within(canvasElement).findByRole('button', { name: `Actions for ${name}` }))
  return within(await body(canvasElement).findByRole('menu'))
}

const itemNames = (menu: ReturnType<typeof within>) => menu.getAllByRole('menuitem').map((i: HTMLElement) => i.textContent?.trim())

/** The master's own character: give it to a player, or take it out. */
export const MasterOwnCharacter: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement, brann.name)
    await expect(itemNames(menu)).toEqual(['Give to a player', 'Take out of the game'])
  },
}

/** A player's own character: only take it out (giving is the master's). */
export const PlayerOwnCharacter: Story = {
  args: { characterId: wren.id },
  decorators: [withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement, wren.name)
    await expect(itemNames(menu)).toEqual(['Take out of the game'])
  },
}

/** A teammate's character, even for the master: no actions at all. */
export const TeammateCharacter: Story = {
  args: { characterId: mirel.id },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

/** A player looking at the master's character. */
export const MastersCharacterForPlayer: Story = {
  args: { characterId: oda.id },
  decorators: [withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

/** A free character has no game actions. */
export const FreeCharacter: Story = {
  args: { characterId: sage.id },
  decorators: [withStores({ characters: [sage] })],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

export const TakeOutConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    const menu = await openMenu(canvasElement, brann.name)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Take out of the game' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Take ${brann.name} out of the game?` }))
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Take out' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(brann.id, { game: '' }))
    await expect(useCharactersStore().metaOf(brann.id)).toEqual({ owner: 'user-mock', game: '' })
    // Free now, so the menu is gone.
    await waitFor(() => expect(within(canvasElement).queryByRole('button')).toBeNull())
  },
}

export const OpensGive: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement, brann.name)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Give to a player' }))
    await expect(await body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to a player` })).toBeVisible()
  },
}
