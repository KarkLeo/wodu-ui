import { computed } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import MembersList from './MembersList.vue'
import { crookhollow, olden, MEMBERS, PARTY, wren, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/MembersList',
  component: MembersList,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow, onTransferred: fn() },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  // The game comes from the store, so a transfer shows the new master at once.
  render: (args) => ({
    components: { MembersList },
    setup() {
      const games = useGamesStore()
      return { args, game: computed(() => games.byId(args.game.id)) }
    },
    template: '<div style="max-width: 420px"><MembersList v-if="game" :game="game" @transferred="args.onTransferred" /></div>',
  }),
} satisfies Meta<typeof MembersList>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const toastTexts = () => useToastsStore().items.map(t => t.text)

/** The master first and marked; per other member "Make master" and "Remove". */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement)
    const rows = list.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(rows[0]).toHaveTextContent(/Anna.*master.*you/)
    await expect(list.queryByRole('button', { name: /Anna/ })).toBeNull()
    for (const who of ['Kostya', 'Yana']) {
      await expect(list.getByRole('button', { name: `Make ${who} the master` })).toBeVisible()
      await expect(list.getByRole('button', { name: `Remove ${who}` })).toBeVisible()
    }
  },
}

/** Read-only for a player: the master is marked, no buttons at all. */
export const AsPlayer: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, PARTY, OLDEN_META)],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement)
    const rows = list.getAllByRole('listitem')
    await expect(rows[0]).toHaveTextContent(/Seva.*master/)
    await expect(rows[1]).toHaveTextContent(/Anna.*you/)
    await expect(list.queryAllByRole('button')).toHaveLength(0)
  },
}

/** A masterless game: nobody is marked and nobody has the master's buttons. */
export const Masterless: Story = {
  args: { game: { ...crookhollow, master: '' } },
  decorators: [withGameTable({ ...crookhollow, master: '' }, PARTY, CROOKHOLLOW_META)],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement)
    await expect(list.queryByText('master')).toBeNull()
    await expect(list.queryAllByRole('button')).toHaveLength(0)
  },
}

/** "Make master" asks first (danger); cancelling writes nothing. */
export const MakeMasterCancel: Story = {
  play: async ({ canvasElement, args }) => {
    const update = spyOn(pb.collection('games'), 'update')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Make Yana the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Yana?' }))
    await expect(confirm.getByText('You will become a player.')).toBeVisible()
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
    await expect(args.onTransferred).not.toHaveBeenCalled()
  },
}

/** Confirmed: the transfer write, the new master marked, the toast, and `transferred` for the screen to move on. */
export const MakeMasterConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const list = within(canvasElement)
    await userEvent.click(list.getByRole('button', { name: 'Make Kostya the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Kostya?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Hand over' }))
    await expect(update).toHaveBeenCalledWith(crookhollow.id, { master: 'user-kostya' })
    await waitFor(() => expect(args.onTransferred).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-kostya' })))
    await expect(toastTexts()).toContain('Kostya is the master now.')
    await waitFor(() => expect(list.getAllByRole('listitem')[0]).toHaveTextContent(/Kostya.*master/))
    await expect(list.queryAllByRole('button')).toHaveLength(0)
  },
}

export const MakeMasterFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Make Kostya the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Kostya?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Hand over' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t hand over the master role. Try again.'))
    await expect(args.onTransferred).not.toHaveBeenCalled()
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe(crookhollow.master)
  },
}

/** Removing asks first (danger); the member and their characters leave the table. */
export const RemoveConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const freeCharacter = spyOn(pb.collection('characters'), 'update')
    const list = within(canvasElement)
    await userEvent.click(list.getByRole('button', { name: 'Remove Kostya' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Remove Kostya from the game?' }))
    await expect(removeMembership).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(removeMembership).toHaveBeenCalledWith(`${crookhollow.id}-user-kostya`))
    await expect(freeCharacter).toHaveBeenCalledWith(wren.id, { game: '' })
    await expect(useCharactersStore().getById(wren.id)).toBeUndefined()
    await expect(useGamesStore().membersOf(crookhollow.id).map(m => m.name)).toEqual(['Anna', 'Yana'])
    await waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(2))
  },
}

export const RemoveCancel: Story = {
  play: async ({ canvasElement }) => {
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const list = within(canvasElement)
    await userEvent.click(list.getByRole('button', { name: 'Remove Yana' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Remove Yana from the game?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(removeMembership).not.toHaveBeenCalled()
    await expect(list.getAllByRole('listitem')).toHaveLength(3)
  },
}

/** A member without a display name: the row and both buttons use the same placeholder. */
export const UnnamedMember: Story = {
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META, MEMBERS.map(m => (m.user === 'user-yana' ? { ...m, name: '' } : m)))],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement)
    await expect(list.getAllByRole('listitem')[2]).toHaveTextContent('—')
    await expect(list.getByRole('button', { name: 'Make — the master' })).toBeVisible()
    await userEvent.click(list.getByRole('button', { name: 'Remove —' }))
    await expect(await body(canvasElement).findByRole('dialog', { name: 'Remove — from the game?' })).toBeVisible()
  },
}
