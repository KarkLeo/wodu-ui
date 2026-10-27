import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import CabinetLayout from './CabinetLayout.vue'
import CharactersView from './CharactersView.vue'
import { brann, crookhollow, draftIdentity, GAMES, inGame, MEMBERS, mirel, olden, sage, wren } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withOnlineLoading, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { pb } from '../../../.storybook/mocks/pb'

// The page as app.vue shows it: the cabinet header above, no table panels around.
const meta = {
  title: 'Screens/Cabinet/CharactersPage',
  component: CharactersView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/characters')],
  render: () => ({
    components: { CabinetLayout, CharactersView },
    template: '<CabinetLayout><CharactersView /></CabinetLayout>',
  }),
} satisfies Meta<typeof CharactersView>

export default meta
type Story = StoryObj<typeof meta>

// Brann is Anna's in Olden's Tower, Wren hers in Crookhollow, Sage free; Mirel is Kostya's.
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

const card = (canvasElement: HTMLElement, name: RegExp) => within(canvasElement).getByRole('button', { name })

export const Characters: Story = {
  decorators: [table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Characters' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Characters' })).toHaveAttribute('aria-current', 'page')
    await expect(card(canvasElement, /Brann Ironhide/)).toHaveTextContent('in “Olden’s Tower”')
    await expect(card(canvasElement, /Wren Ashfoot/)).toHaveTextContent('in “Shadows over Crookhollow”')
    await expect(card(canvasElement, /Sage/)).toHaveTextContent('free')
    await expect(canvas.queryByText('Mirel Vane')).not.toBeInTheDocument()
    await expect(card(canvasElement, /Unnamed/)).toHaveTextContent('Resume creation')
  },
}

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [table],
}

export const Loading: Story = {
  decorators: [withOnlineLoading, table],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading…')
    await expect(canvas.queryByText('No characters yet')).toBeNull()
  },
}

export const Empty: Story = {
  decorators: [withStores({ characters: [], games: GAMES, members: MEMBERS })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No characters yet')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create character' })).toBeVisible()
  },
}

export const OpenCharacterInGame: Story = {
  tags: ['no-visual'],
  decorators: [table],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Brann Ironhide/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}/party/${brann.id}`))
  },
}

export const OpenFreeCharacter: Story = {
  tags: ['no-visual'],
  decorators: [table],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(card(canvasElement, /Sage/))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/party/${sage.id}`))
  },
}

export const CreateFreeCharacter: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [] })],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('characters'), 'create')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Create character' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/character/new'))
    await expect(create).toHaveBeenCalledWith(expect.objectContaining({ game: '' }))
  },
}
