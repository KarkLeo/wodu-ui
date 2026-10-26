import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import HomeView from './HomeView.vue'
import { brann, crookhollow, draftIdentity, GAMES, inGame, MEMBERS, mirel, olden, sage, wren } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { pb } from '../../../.storybook/mocks/pb'

const TAB_KEY = 'wod.home.tab.v1'

const meta = {
  title: 'Screens/Home',
  component: HomeView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/games')],
  beforeEach() {
    localStorage.removeItem(TAB_KEY)
    return () => localStorage.removeItem(TAB_KEY)
  },
} satisfies Meta<typeof HomeView>

export default meta
type Story = StoryObj<typeof meta>

// Anna runs Crookhollow (Wren is hers there) and plays Brann in Olden's Tower; Mirel is Kostya's in Olden's
// Tower; Sage is free.
const table = withStores({
  characters: [brann, wren, mirel, sage, draftIdentity],
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

export const GamesTab: Story = {
  decorators: [table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tab', { name: 'Games' })).toHaveAttribute('aria-selected', 'true')
    const master = card(canvasElement, /Shadows over Crookhollow/)
    await expect(master).toHaveTextContent('master')
    await expect(master).toHaveTextContent('Players: 2')
    await expect(master).not.toHaveTextContent('Yours')
    const player = card(canvasElement, /Olden’s Tower/)
    await expect(player).toHaveTextContent('player')
    await expect(player).toHaveTextContent('Master: Seva')
    await expect(player).toHaveTextContent('Yours: Brann Ironhide')
    await expect(player).not.toHaveTextContent('Mirel')
  },
}

export const OpenGame: Story = {
  tags: ['no-visual'],
  decorators: [table],
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Olden’s Tower/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}`))
  },
}

export const CharactersTab: Story = {
  decorators: [table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: 'Characters' }))
    await expect(card(canvasElement, /Brann Ironhide/)).toHaveTextContent('in “Olden’s Tower”')
    await expect(card(canvasElement, /Wren Ashfoot/)).toHaveTextContent('in “Shadows over Crookhollow”')
    await expect(card(canvasElement, /Sage/)).toHaveTextContent('free')
    await expect(canvas.queryByText('Mirel Vane')).not.toBeInTheDocument()
    await expect(card(canvasElement, /Unnamed/)).toHaveTextContent('Resume creation')
    await expect(localStorage.getItem(TAB_KEY)).toBe('characters')
  },
}

export const OpenCharacterInGame: Story = {
  tags: ['no-visual'],
  decorators: [table],
  beforeEach() {
    localStorage.setItem(TAB_KEY, 'characters')
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Brann Ironhide/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}/party/${brann.id}`))
  },
}

export const OpenFreeCharacter: Story = {
  tags: ['no-visual'],
  decorators: [table],
  beforeEach() {
    localStorage.setItem(TAB_KEY, 'characters')
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Sage/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/party/${sage.id}`))
  },
}

/** The tab is remembered per viewer. */
export const RemembersTab: Story = {
  decorators: [table],
  beforeEach() {
    localStorage.setItem(TAB_KEY, 'characters')
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('tab', { name: 'Characters' })).toHaveAttribute('aria-selected', 'true')
  },
}

export const CreateFreeCharacter: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [] })],
  beforeEach() {
    localStorage.setItem(TAB_KEY, 'characters')
  },
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('characters'), 'create')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Create character' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/character/new'))
    await expect(create).toHaveBeenCalledWith(expect.objectContaining({ game: '' }))
  },
}

export const EmptyGames: Story = {
  decorators: [withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No games yet')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create game' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Join by code' })).toBeVisible()
  },
}

export const EmptyCharacters: Story = {
  decorators: [withStores({ characters: [], games: GAMES, members: MEMBERS })],
  beforeEach() {
    localStorage.setItem(TAB_KEY, 'characters')
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No characters yet')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create character' })).toBeVisible()
  },
}

export const CreateGameValidation: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [] })],
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
