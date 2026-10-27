import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import GamesTab from './GamesTab.vue'
import { brann, crookhollow, GAMES, inGame, MEMBERS, olden } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'

const meta = {
  title: 'Screens/Cabinet/GamesTab',
  component: GamesTab,
  globals: { viewport: { value: 'phone', isRotated: false } },
  loaders: [atRoute('/games')],
} satisfies Meta<typeof GamesTab>

export default meta
type Story = StoryObj<typeof meta>

export const MasterAndPlayer: Story = {
  decorators: [withStores({ characters: [brann], games: GAMES, members: MEMBERS, meta: { [brann.id]: inGame(olden) } })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Shadows over Crookhollow/ })).toHaveTextContent('master')
    await expect(canvas.getByRole('button', { name: /Olden’s Tower/ })).toHaveTextContent('Yours: Brann Ironhide')
  },
}

/** A player with no character in the game yet. */
export const PlayerWithoutCharacter: Story = {
  decorators: [withStores({ characters: [], games: [olden], members: MEMBERS })],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Olden’s Tower/ })).toHaveTextContent('No character of yours yet')
  },
}

/** The master deleted their account: the game stays, without a master. */
export const Masterless: Story = {
  decorators: [withStores({
    characters: [],
    games: [{ ...olden, master: '' }],
    members: MEMBERS.filter(m => m.user !== 'user-seva'),
  })],
  play: async ({ canvasElement }) => {
    const game = within(canvasElement).getByRole('button', { name: /Olden’s Tower/ })
    await expect(game).toHaveTextContent('No master')
    await expect(game).toHaveTextContent('Players: 2')
  },
}

export const Empty: Story = {
  decorators: [withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No games yet')).toBeVisible()
  },
}

export const OnlyMine: Story = {
  decorators: [withStores({ characters: [], games: [crookhollow], members: MEMBERS })],
}
