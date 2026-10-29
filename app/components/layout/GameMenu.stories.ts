import { computed } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import GameMenu from './GameMenu.vue'
import { crookhollow, olden, PARTY, sage, wren, CROOKHOLLOW_META, GAMES, MEMBERS, OLDEN_META } from '@/stories/fixtures'
import { atRoute, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useRouteRecheck } from '@/composables/useRouteRecheck'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/GameMenu',
  component: GameMenu,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow },
  // The game comes from the store, as in the players panel, so the menu follows changes to it.
  render: (args) => ({
    components: { GameMenu },
    setup() {
      const games = useGamesStore()
      return { game: computed(() => games.byId(args.game.id)) }
    },
    template: '<div style="display: flex; justify-content: flex-end; padding: 16px"><GameMenu v-if="game" :game="game" /></div>',
  }),
} satisfies Meta<typeof GameMenu>

export default meta
type Story = StoryObj<typeof meta>

const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function openMenu(canvasElement: HTMLElement) {
  await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Game menu' }))
  return within(await screen(canvasElement).findByRole('menu'))
}

const items = (menu: ReturnType<typeof within>) => menu.getAllByRole('menuitem').map((i: HTMLElement) => i.textContent?.trim())

// Runs the pages' route re-check, which bounces a player who lost the game home with a toast.
const recheck: Decorator = (story) => ({
  components: { story },
  setup() {
    useRouteRecheck()
  },
  template: '<story />',
})

const leftToast = 'You’re no longer in that game.'
const toastTexts = () => useToastsStore().items.map(t => t.text)

export const AsMaster: Story = {
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(items(menu)).toEqual(['Game settings', 'Monster library', 'Item library', 'Bring one of mine', 'Home'])
  },
}

/** A masterless game: nobody has the master's items, everyone the player's. */
export const Masterless: Story = {
  args: { game: { ...crookhollow, master: '' } },
  decorators: [withGameTable({ ...crookhollow, master: '' }, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(items(menu)).toEqual(['Invite players', 'Members', 'Bring one of mine', 'Home', 'Leave game'])
  },
}

/** The master's game settings are a screen of their own. */
export const OpensSettings: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Game settings' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/settings`))
  },
}

/** The master's monster library is a screen of its own too; players never see the item. */
export const OpensMonsterLibrary: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Monster library' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/monsters`))
  },
}

/** The item library is the master's too. */
export const OpensItemLibrary: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Item library' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/items`))
  },
}

export const AsPlayer: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await expect(items(menu)).toEqual(['Invite players', 'Members', 'Bring one of mine', 'Home', 'Leave game'])
  },
}

export const OpensInvite: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Invite players' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Invite players' })
    await expect(within(dialog).getByText('M4RT-8WZN')).toBeVisible()
  },
}

export const OpensMembers: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Members' }))
    const dialog = within(await screen(canvasElement).findByRole('dialog', { name: 'Members' }))
    await expect(dialog.getAllByRole('listitem')).toHaveLength(3)
    await expect(dialog.queryByRole('button', { name: /^Remove/ })).toBeNull()
  },
}

export const OpensBring: Story = {
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Bring one of mine' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Bring one of mine' })
    await expect(within(dialog).getByRole('button', { name: new RegExp(sage.name) })).toBeVisible()
  },
}

export const GoesHome: Story = {
  tags: ['no-visual'],
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Home' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
  },
}

const bothGames = withStores({
  characters: [...PARTY, sage],
  games: GAMES,
  members: MEMBERS,
  meta: { ...CROOKHOLLOW_META, ...OLDEN_META },
  scope: { kind: 'game', gameId: olden.id },
})

/**
 * Leaving on purpose: my characters there become free, the membership goes, home with no "no longer in
 * that game" toast. The quiet ends with the leave, so losing the game again later still shows it.
 */
export const LeaveConfirm: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  args: { game: olden },
  decorators: [recheck, bothGames],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const updateCharacter = spyOn(pb.collection('characters'), 'update')
    const removeMembership = spyOn(pb.collection('game_members'), 'delete')
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Leave game' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: `Leave “${olden.name}”?` })
    await expect(removeMembership).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(updateCharacter).toHaveBeenCalledWith(wren.id, { game: '' })
    await expect(removeMembership).toHaveBeenCalledWith(`${olden.id}-user-mock`)
    await expect(useCharactersStore().metaOf(wren.id)?.game).toBe('')
    await expect(toastTexts()).not.toContain(leftToast)

    // Back in the game later (rejoined), then removed: this time the toast shows.
    const games = useGamesStore()
    games.upsertGame(olden)
    games.upsertMember({ id: 'rejoined', game: olden.id, user: 'user-mock', name: 'Anna' })
    await storyRouter.push(`/games/${olden.id}`)
    games.removeGame(olden.id)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(toastTexts()).toContain(leftToast)
  },
}

/** A failed leave stays on the table with the write-failure toast. */
export const LeaveFails: Story = {
  tags: ['no-visual'],
  args: { game: olden },
  decorators: [recheck, withGameTable(olden, [...PARTY, sage], OLDEN_META)],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const { ClientResponseError } = await import('pocketbase')
    spyOn(pb.collection('game_members'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const menu = await openMenu(canvasElement)
    await userEvent.click(menu.getByRole('menuitem', { name: 'Leave game' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: `Leave “${olden.name}”?` })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t leave the game. Try again.'))
    await expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}`)
  },
}
