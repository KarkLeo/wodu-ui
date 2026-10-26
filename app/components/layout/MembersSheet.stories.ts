import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import MembersSheet from './MembersSheet.vue'
import { crookhollow, olden, PARTY, wren, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/MembersSheet',
  component: MembersSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow, open: true, 'onUpdate:open': fn() },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
} satisfies Meta<typeof MembersSheet>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const dialog = (canvasElement: HTMLElement) =>
  body(canvasElement).findByRole('dialog', { name: 'Members' }).then(d => within(d))

/** The master sees everyone, themselves marked, and can remove the others. */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const rows = sheet.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(rows[0]).toHaveTextContent(/Anna.*master.*you/)
    await expect(sheet.queryByRole('button', { name: 'Remove Anna' })).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Remove Kostya' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Remove Yana' })).toBeVisible()
  },
}

/** A player sees the members with the master marked, and no remove buttons. */
export const AsPlayer: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, PARTY, OLDEN_META)],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const rows = sheet.getAllByRole('listitem')
    await expect(rows[0]).toHaveTextContent(/Seva.*master/)
    await expect(sheet.queryByRole('button', { name: /^Remove/ })).toBeNull()
  },
}

/** Removing asks first (danger); the member and their characters leave the table. */
export const RemoveConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const freeCharacter = spyOn(pb.collection('characters'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Kostya' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Remove Kostya from the game?' }))
    await expect(removeMembership).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(removeMembership).toHaveBeenCalledWith(`${crookhollow.id}-user-kostya`))
    await expect(freeCharacter).toHaveBeenCalledWith(wren.id, { game: '' })
    await expect(useCharactersStore().getById(wren.id)).toBeUndefined()
    await expect(useGamesStore().membersOf(crookhollow.id).map(m => m.name)).toEqual(['Anna', 'Yana'])
    await waitFor(() => expect(sheet.getAllByRole('listitem')).toHaveLength(2))
  },
}

export const RemoveCancel: Story = {
  play: async ({ canvasElement }) => {
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Remove Yana' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Remove Yana from the game?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(removeMembership).not.toHaveBeenCalled()
    await expect(sheet.getAllByRole('listitem')).toHaveLength(3)
  },
}
