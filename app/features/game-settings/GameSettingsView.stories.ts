import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import GameSettingsView from './GameSettingsView.vue'
import { brann, crookhollow, olden, PARTY, sage, wren, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { atRoute, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/GameSettings',
  component: GameSettingsView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}/settings`)],
} satisfies Meta<typeof GameSettingsView>

export default meta
type Story = StoryObj<typeof meta>

// Runs the page's route re-check, as pages/games/[gameId]/settings.vue does.
const recheck: Decorator = (story) => ({
  components: { story },
  setup() {
    useRouteRecheck()
  },
  template: '<story />',
})

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const section = (canvasElement: HTMLElement, name: string) => within(within(canvasElement).getByRole('region', { name }))
const toastTexts = () => useToastsStore().items.map(t => t.text)
const tablePath = `/games/${crookhollow.id}`

/** The master's settings: name, invite, members (with their controls) and delete. */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Game settings' })).toBeVisible()

    const name = section(canvasElement, 'Name')
    await expect(name.getByLabelText('Game name')).toHaveValue(crookhollow.name)
    await expect(name.getByRole('button', { name: 'Save' })).toBeDisabled()

    const invite = section(canvasElement, 'Invite')
    await expect(invite.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
    await expect(invite.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await expect(invite.getByRole('button', { name: 'Reset code' })).toBeVisible()

    const members = section(canvasElement, 'Members')
    const rows = members.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(rows[0]).toHaveTextContent(/Anna.*master.*you/)
    await expect(members.queryByRole('button', { name: 'Make Anna the master' })).toBeNull()
    await expect(members.queryByRole('button', { name: 'Remove Anna' })).toBeNull()
    for (const who of ['Kostya', 'Yana']) {
      await expect(members.getByRole('button', { name: `Make ${who} the master` })).toBeVisible()
      await expect(members.getByRole('button', { name: `Remove ${who}` })).toBeVisible()
    }

    await expect(section(canvasElement, 'Delete game').getByRole('button', { name: 'Delete game' })).toBeVisible()
  },
}

export const AsMasterDesktop: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('region', { name: 'Members' })).toBeVisible()
  },
}

/** Save stays disabled while the name is unchanged, empty or too long; a valid change saves and says so. */
export const Rename: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const name = section(canvasElement, 'Name')
    const field = name.getByLabelText('Game name')
    const save = name.getByRole('button', { name: 'Save' })

    await userEvent.clear(field)
    await expect(save).toBeDisabled()
    await userEvent.type(field, '   ')
    await expect(save).toBeDisabled()

    await userEvent.clear(field)
    await userEvent.type(field, 'x'.repeat(81))
    await expect(name.getByRole('alert')).toHaveTextContent('At most 80 characters.')
    await expect(save).toBeDisabled()

    await userEvent.clear(field)
    await userEvent.type(field, `  ${crookhollow.name}  `)
    await expect(save).toBeDisabled()

    await userEvent.clear(field)
    await userEvent.type(field, '  The Drowned Abbey  ')
    await expect(save).toBeEnabled()
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(save)

    await expect(update).toHaveBeenCalledWith(crookhollow.id, { name: 'The Drowned Abbey' })
    await waitFor(() => expect(name.getByRole('status')).toHaveTextContent('Saved.'))
    await expect(field).toHaveValue('The Drowned Abbey')
    await expect(useGamesStore().byId(crookhollow.id)?.name).toBe('The Drowned Abbey')
    await expect(save).toBeDisabled()

    await userEvent.type(field, '!')
    await expect(name.getByRole('status')).toHaveTextContent('')
  },
}

/** A refused rename says so under the field and keeps the old name. */
export const RenameFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const name = section(canvasElement, 'Name')
    const field = name.getByLabelText('Game name')
    await userEvent.clear(field)
    await userEvent.type(field, 'The Drowned Abbey')
    await userEvent.click(name.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(name.getByRole('alert')).toHaveTextContent('Couldn’t rename the game. Try again.'))
    await expect(name.getByRole('status')).toHaveTextContent('')
    await expect(useGamesStore().byId(crookhollow.id)?.name).toBe(crookhollow.name)
    await expect(name.getByRole('button', { name: 'Save' })).toBeEnabled()
  },
}

/** A rename from elsewhere (realtime) shows up in an untouched field. */
export const RenamedElsewhere: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const field = section(canvasElement, 'Name').getByLabelText('Game name')
    useGamesStore().upsertGame({ ...crookhollow, name: 'Renamed on another device' })
    await waitFor(() => expect(field).toHaveValue('Renamed on another device'))
  },
}

/** "Make master" asks first; cancelling writes nothing and keeps me the master. */
export const MakeMasterCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    await userEvent.click(section(canvasElement, 'Members').getByRole('button', { name: 'Make Kostya the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Kostya?' }))
    await expect(confirm.getByText('You will become a player.')).toBeVisible()
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe(crookhollow.master)
    await expect(storyRouter.currentRoute.value.path).toBe(`${tablePath}/settings`)
  },
}

/**
 * Confirming hands the role over: the write goes out, the game shows Kostya as master, and the former
 * master lands on the table with a toast. Their own character stays theirs; Kostya's turns read-only.
 */
export const MakeMasterConfirm: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const characters = useCharactersStore()
    await expect(characters.canEditCharacter(wren.id)).toBe(true)
    await userEvent.click(section(canvasElement, 'Members').getByRole('button', { name: 'Make Kostya the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Kostya?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Hand over' }))

    await expect(update).toHaveBeenCalledWith(crookhollow.id, { master: 'user-kostya' })
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(tablePath))
    await expect(toastTexts()).toContain('Kostya is the master now.')
    await expect(toastTexts()).not.toContain('You’re no longer in that game.')
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe('user-kostya')
    await expect(characters.canEditCharacter(brann.id)).toBe(true)
    await expect(characters.canEditCharacter(wren.id)).toBe(false)
  },
}

/** A refused transfer keeps me the master and on the settings screen, with the write-failure toast. */
export const MakeMasterFails: Story = {
  tags: ['no-visual'],
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await userEvent.click(section(canvasElement, 'Members').getByRole('button', { name: 'Make Yana the master' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Hand the master role to Yana?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Hand over' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t hand over the master role. Try again.'))
    await expect(toastTexts()).not.toContain('Yana is the master now.')
    await expect(useGamesStore().byId(crookhollow.id)?.master).toBe(crookhollow.master)
    await expect(storyRouter.currentRoute.value.path).toBe(`${tablePath}/settings`)
  },
}

/** Removing a member from the settings uses the same danger confirm as before. */
export const RemoveMember: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const members = section(canvasElement, 'Members')
    await userEvent.click(members.getByRole('button', { name: 'Remove Yana' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: 'Remove Yana from the game?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(removeMembership).toHaveBeenCalledWith(`${crookhollow.id}-user-yana`))
    await waitFor(() => expect(members.getAllByRole('listitem')).toHaveLength(2))
  },
}

/** Deleting the game asks first, then goes home without the "no longer in that game" toast. */
export const DeleteGame: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb.collection('games'), 'delete')
    await userEvent.click(section(canvasElement, 'Delete game').getByRole('button', { name: 'Delete game' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Delete “${crookhollow.name}”?` }))
    await expect(remove).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/'))
    await expect(remove).toHaveBeenCalledWith(crookhollow.id)
    await expect(useCharactersStore().metaOf(brann.id)?.game).toBe('')
    await expect(toastTexts()).not.toContain('You’re no longer in that game.')
  },
}

export const DeleteCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb.collection('games'), 'delete')
    await userEvent.click(section(canvasElement, 'Delete game').getByRole('button', { name: 'Delete game' }))
    const confirm = within(await body(canvasElement).findByRole('dialog', { name: `Delete “${crookhollow.name}”?` }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(remove).not.toHaveBeenCalled()
    await expect(storyRouter.currentRoute.value.path).toBe(`${tablePath}/settings`)
  },
}

/** A player who opens the settings of a game they play in is sent to its table. */
export const NonMasterRedirected: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck, withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}/settings`)],
  play: async () => {
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}`))
    await expect(toastTexts()).not.toContain('You’re no longer in that game.')
  },
}

/** The role moves away while the screen is open (realtime, e.g. from another device): back to the table. */
export const LosesMasterWhileOpen: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('region', { name: 'Members' })).toBeVisible()
    useGamesStore().upsertGame({ ...crookhollow, master: 'user-yana' })
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(tablePath))
  },
}

/** Removed from the game while the screen is open: home, with the usual toast. */
export const RemovedWhileOpen: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [recheck],
  play: async () => {
    useGamesStore().removeGame(crookhollow.id)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/'))
    await expect(toastTexts()).toContain('You’re no longer in that game.')
  },
}

/** A deep link before the game is known shows the loading line, not an empty form. */
export const Loading: Story = {
  decorators: [withGameTable({ ...crookhollow, id: 'story-game-unknown' }, [], {})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading…')
    await expect(canvas.queryByRole('region', { name: 'Name' })).toBeNull()
  },
}
