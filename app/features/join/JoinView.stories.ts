import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import JoinView from './JoinView.vue'
import { crookhollow, MEMBERS } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useGamesStore } from '@/stores/games'
import { pb, seedRecords } from '../../../.storybook/mocks/pb'

// A game the story user is not in yet; its record exists on the "server" only.
const ember = { id: 'story-game-ember', name: 'Ember Road', master: 'user-seva', invite_code: 'EMBR2345' }

const meta = {
  title: 'Screens/Join',
  component: JoinView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [], games: [crookhollow], members: MEMBERS.filter(m => m.game === crookhollow.id) })],
} satisfies Meta<typeof JoinView>

export default meta
type Story = StoryObj<typeof meta>

const at = (code: string) => ({ args: { code }, loaders: [atRoute(`/join/${code}`)] })

export const Joins: Story = {
  ...at('embr-2345'),
  tags: ['no-visual'],
  beforeEach() {
    seedRecords('games', [ember])
    spyOn(pb.collection('game_members'), 'create')
  },
  play: async () => {
    const create = pb.collection('game_members').create
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${ember.id}`))
    await expect(create).toHaveBeenCalledWith(
      { game: ember.id, user: 'user-mock', code: 'EMBR2345' },
      { expand: 'user' },
    )
    await expect(useGamesStore().byId(ember.id)?.name).toBe('Ember Road')
  },
}

/** The code was reset, or never existed: a clear message and a way home. */
export const NotFound: Story = {
  ...at('ZZZZ2222'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('This invite is not valid')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Home' })).toBeVisible()
  },
}

export const NotFoundGoesHome: Story = {
  ...at('ZZZZ2222'),
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Home' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
  },
}

export const MalformedCode: Story = {
  ...at('hello'),
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const getList = spyOn(pb.collection('games'), 'getList')
    await expect(await within(canvasElement).findByText('This invite is not valid')).toBeVisible()
    await expect(getList).not.toHaveBeenCalled()
  },
}

export const AlreadyMember: Story = {
  ...at('K7QX-29AB'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('You’re already in “Shadows over Crookhollow”')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Open the table' })).toBeVisible()
  },
}

export const AlreadyMemberOpensTable: Story = {
  ...at('K7QX-29AB'),
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Open the table' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}

export const LookupFails: Story = {
  ...at('EMBR2345'),
  tags: ['no-visual'],
  // The lookup starts on mount, before play() runs.
  beforeEach() {
    spyOn(pb.collection('games'), 'getList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t join the game. Try again.')
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

/** The session expired between the lookup and the join (403): not a bad invite, so the retry is offered. */
export const JoinRefusedSessionExpired: Story = {
  ...at('EMBR2345'),
  tags: ['no-visual'],
  beforeEach() {
    seedRecords('games', [ember])
    spyOn(pb.collection('game_members'), 'create').mockRejectedValueOnce(new ClientResponseError({ status: 403 }))
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t join the game. Try again.')
    await expect(canvas.queryByText('This invite is not valid')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

/** Joined from another session meanwhile: the duplicate's 400 ends on "already in", not "not valid". */
export const JoinedMeanwhileElsewhere: Story = {
  ...at('EMBR2345'),
  tags: ['no-visual'],
  beforeEach() {
    seedRecords('games', [ember])
    spyOn(pb.collection('game_members'), 'create').mockRejectedValueOnce(new ClientResponseError({ status: 400 }))
    spyOn(pb.collection('game_members'), 'getFullList').mockResolvedValueOnce([
      { id: 'story-member-ember', game: ember.id, user: 'user-mock', expand: { user: { name: 'Anna' } } },
    ] as never)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('You’re already in “Ember Road”')).toBeVisible()
    await expect(canvas.queryByText('This invite is not valid')).toBeNull()
  },
}
