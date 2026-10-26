import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import GiveCharacterSheet from './GiveCharacterSheet.vue'
import { brann, crookhollow, MEMBERS, PARTY, CROOKHOLLOW_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/GiveCharacterSheet',
  component: GiveCharacterSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { characterId: brann.id, gameId: crookhollow.id, open: true, 'onUpdate:open': fn(), onGiven: fn() },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
} satisfies Meta<typeof GiveCharacterSheet>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const dialog = (canvasElement: HTMLElement) =>
  body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to a player` }).then(d => within(d))

/** The other members of the game; the master is not offered. */
export const Members: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByRole('button', { name: 'Kostya' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Yana' })).toBeVisible()
    await expect(sheet.queryByRole('button', { name: /Anna/ })).toBeNull()
  },
}

/** Giving asks first; the chosen member becomes the owner. */
export const GiveConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: /Kostya/ }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to Kostya?` }))
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Give' }))
    await waitFor(() => expect(args.onGiven).toHaveBeenCalledWith('user-kostya'))
    await expect(update).toHaveBeenCalledWith(brann.id, { owner: 'user-kostya' })
    await expect(useCharactersStore().metaOf(brann.id)).toEqual({ owner: 'user-kostya', game: crookhollow.id })
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false)
  },
}

export const GiveCancel: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: /Yana/ }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Give ${brann.name} to Yana?` }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
  },
}

/** Nobody else has joined yet. */
export const NoOtherPlayers: Story = {
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META, MEMBERS.filter(m => m.user === 'user-mock'))],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByText('No other players in the game yet.')).toBeVisible()
  },
}
