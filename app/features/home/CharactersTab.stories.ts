import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CharactersTab from './CharactersTab.vue'
import { brann, draftIdentity, draftTraining, GAMES, inGame, MEMBERS, olden, sage } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useCreationStore } from '@/stores/creation'

const meta = {
  title: 'Screens/Home/CharactersTab',
  component: CharactersTab,
  globals: { viewport: { value: 'phone', isRotated: false } },
  loaders: [atRoute('/')],
} satisfies Meta<typeof CharactersTab>

export default meta
type Story = StoryObj<typeof meta>

export const FreeAndInGame: Story = {
  decorators: [withStores({ characters: [brann, sage], games: GAMES, members: MEMBERS, meta: { [brann.id]: inGame(olden) } })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Brann Ironhide/ })).toHaveTextContent('in “Olden’s Tower”')
    await expect(canvas.getByRole('button', { name: /Sage/ })).toHaveTextContent('free')
  },
}

const withDrafts = withStores({
  characters: [draftIdentity, draftTraining],
  games: GAMES,
  members: MEMBERS,
  meta: { [draftTraining.id]: inGame(olden) },
})

export const Drafts: Story = {
  decorators: [withDrafts],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('button', { name: /Resume creation/ })).toHaveLength(2)
  },
}

/** A draft started at a game's table resumes there. */
export const DraftResumesInGame: Story = {
  tags: ['no-visual'],
  decorators: [withDrafts],
  play: async ({ canvasElement }) => {
    const drafts = within(canvasElement).getAllByRole('button', { name: /Resume creation/ })
    const inOlden = drafts.find(d => d.textContent?.includes('Olden’s Tower'))!
    await userEvent.click(inOlden)
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${olden.id}/new`))
    await expect(useCreationStore().draftId).toBe(draftTraining.id)
  },
}

export const Empty: Story = {
  decorators: [withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No characters yet')).toBeVisible()
  },
}
