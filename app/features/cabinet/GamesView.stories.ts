import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import CabinetLayout from './CabinetLayout.vue'
import GamesView from './GamesView.vue'
import { brann, crookhollow, GAMES, inGame, MEMBERS, mirel, olden, sage, wren } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withOnlineLoading, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { pb } from '../../../.storybook/mocks/pb'

// The page as app.vue shows it: the cabinet header above, no table panels around.
const meta = {
  title: 'Screens/Cabinet/GamesPage',
  component: GamesView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/games')],
  render: () => ({
    components: { CabinetLayout, GamesView },
    template: '<CabinetLayout><GamesView /></CabinetLayout>',
  }),
} satisfies Meta<typeof GamesView>

export default meta
type Story = StoryObj<typeof meta>

// Anna runs Crookhollow (Wren is hers there) and plays Brann in Olden's Tower; Mirel is Kostya's in Olden's
// Tower; Sage is free.
const table = withStores({
  characters: [brann, wren, mirel, sage],
  games: GAMES,
  members: MEMBERS,
  meta: {
    [brann.id]: inGame(olden),
    [wren.id]: inGame(crookhollow),
    [mirel.id]: { owner: 'user-kostya', game: olden.id },
  },
})

const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const card = (canvasElement: HTMLElement, name: RegExp) => within(canvasElement).getByRole('button', { name })

export const Games: Story = {
  decorators: [table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Games' })).toHaveAttribute('aria-current', 'page')
    const master = card(canvasElement, /Shadows over Crookhollow/)
    await expect(master).toHaveTextContent('master')
    await expect(master).toHaveTextContent('Players: 2')
    await expect(master).not.toHaveTextContent('Yours')
    const player = card(canvasElement, /Olden’s Tower/)
    await expect(player).toHaveTextContent('player')
    await expect(player).toHaveTextContent('Master: Seva')
    await expect(player).toHaveTextContent('Yours: Brann Ironhide')
    await expect(player).not.toHaveTextContent('Mirel')
    // No table around the cabinet.
    await expect(canvas.queryByRole('button', { name: 'New character' })).toBeNull()
  },
}

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [table],
}

/** Opened from the landing, the account's data loads in the background. */
export const Loading: Story = {
  decorators: [withOnlineLoading, table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading…')
    await expect(canvas.queryByText('No games yet')).toBeNull()
  },
}

export const Empty: Story = {
  decorators: [withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No games yet')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create game' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Join by code' })).toBeVisible()
  },
}

export const OpenGame: Story = {
  tags: ['no-visual'],
  decorators: [table],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Olden’s Tower/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}`))
  },
}

export const CreateGameValidation: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [] })],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('games'), 'create')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Create game' }))
    const dialog = within(await screen(canvasElement).findByRole('dialog', { name: 'New game' }))
    const submit = dialog.getByRole('button', { name: 'Create' })
    await expect(submit).toBeDisabled()
    const field = dialog.getByLabelText('Game name')
    await userEvent.type(field, '   ')
    await expect(submit).toBeDisabled()
    await userEvent.type(field, 'x'.repeat(81))
    await expect(dialog.getByRole('alert')).toHaveTextContent('At most 80 characters.')
    await expect(submit).toBeDisabled()
    await userEvent.clear(field)
    await userEvent.type(field, '  The Sunken Abbey  ')
    await expect(dialog.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(submit)
    await expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'The Sunken Abbey', master: 'user-mock' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toMatch(/^\/games\/[\w-]+$/))
  },
}

export const JoinByCodeNormalises: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [] })],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Join by code' }))
    const dialog = within(await screen(canvasElement).findByRole('dialog', { name: 'Join by code' }))
    const field = dialog.getByLabelText('Invite code')
    await userEvent.type(field, 'k7qx-29a')
    await userEvent.click(dialog.getByRole('button', { name: 'Join' }))
    await expect(dialog.getByRole('alert')).toHaveTextContent('doesn’t look like an invite code')
    await userEvent.type(field, 'b ')
    await userEvent.click(dialog.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/join/K7QX29AB'))
  },
}
