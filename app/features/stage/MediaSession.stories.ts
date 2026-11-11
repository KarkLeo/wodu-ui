import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { defineComponent, onUnmounted } from 'vue'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { atRoute, withGameTable, withStores } from '@/stories/state'
import { loadGame } from '@/transport/games'
import { useGamesStore } from '@/stores/games'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { closeMedia } from '@/transport/media'
import { useMediaSession } from '@/composables/useMediaSession'
import { useStageControl } from '@/composables/useStageControl'
import { clearPbRequests, pbRequests, resetRecords, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'

// Story-only harness: the session and the master's two switches have no screen yet.
const Harness = defineComponent({
  setup() {
    const media = useMediaStore()
    media.clearAll()
    useStageStore().clearAll()
    useMediaSession()
    // The next story starts with nothing listening, as a fresh page would.
    onUnmounted(closeMedia)
    const { activeSceneId, turnOnScene, turnOffScene } = useStageControl()
    return { media, activeSceneId, on: () => turnOnScene(media.scenes.list[0]!), off: () => turnOffScene() }
  },
  template: `
    <div>
      <p data-testid="status">{{ media.scenes.status }}</p>
      <p data-testid="count">{{ media.scenes.list.length }}</p>
      <p data-testid="active">{{ activeSceneId ?? 'none' }}</p>
      <button type="button" @click="on">On</button>
      <button type="button" @click="off">Off</button>
    </div>`,
})

const meta = {
  title: 'Features/Stage/MediaSession',
  component: Harness,
  tags: ['no-visual'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

const SCENE_ID = 'story-scene-crypt'

const seed = async () => {
  clearPbRequests()
  resetRecords('stages')
  resetRecords('scenes', [
    { id: SCENE_ID, game: crookhollow.id, data: { id: SCENE_ID, name: 'Crypt' }, image: 'image.jpg', sound: 'sound.mp3' },
    { id: 'story-scene-other', game: olden.id, data: { id: 'story-scene-other', name: 'Tower' }, image: 'image.png', sound: '' },
  ])
}

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const asPlayer = withGameTable(olden, [], {})

const requestsFor = (name: string) => pbRequests().filter(r => r.startsWith(`${name}.`))
const flush = () => new Promise(resolve => setTimeout(resolve, 150))

/** The master's table opens the game's scenes once: one list, one subscription, only this game's scenes. */
export const MasterOpensTheScenes: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('status')).toHaveTextContent('ready'))
    await expect(canvas.getByTestId('count')).toHaveTextContent('1')
    await flush()
    await expect(requestsFor('scenes').filter(r => r === 'scenes.getFullList')).toHaveLength(1)
    await expect(requestsFor('scenes').filter(r => r === 'scenes.subscribe')).toHaveLength(1)
  },
}

/** A player's client never asks for the scenes. */
export const PlayerNeverOpensThem: Story = {
  decorators: [asPlayer],
  loaders: [seed, atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await flush()
    await expect(canvas.getByTestId('status')).toHaveTextContent('idle')
    await expect(requestsFor('scenes')).toEqual([])
  },
}

/** Another master takes the game over: the scenes are dropped, and no list is read for the new one. */
export const MasterChangeClearsTheStore: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('status')).toHaveTextContent('ready'))
    const games = useGamesStore()
    games.upsertGame({ ...crookhollow, master: 'user-seva' })
    await waitFor(() => expect(canvas.getByTestId('status')).toHaveTextContent('idle'))
    await expect(canvas.getByTestId('count')).toHaveTextContent('0')
    await expect(useMediaStore().gameId).toBeNull()
  },
}

/** On writes the stage with the scene's two file references and no name; off writes no scene. */
export const TurnOnAndOff: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('count')).toHaveTextContent('1'))
    await userEvent.click(canvas.getByRole('button', { name: 'On' }))
    await waitFor(() => expect(storedRecords('stages')[0]?.data).toMatchObject({ id: crookhollow.id }))
    await expect(storedRecords('stages')[0]!.data).toEqual({
      id: crookhollow.id,
      scene: {
        id: SCENE_ID,
        image: { collection: 'scenes', record: SCENE_ID, name: 'image.jpg' },
        sound: { collection: 'scenes', record: SCENE_ID, name: 'sound.mp3' },
      },
      image: null,
      sound: null,
    })
    await expect(canvas.getByTestId('active')).toHaveTextContent(SCENE_ID)
    await userEvent.click(canvas.getByRole('button', { name: 'Off' }))
    await waitFor(() => expect((storedRecords('stages')[0]!.data as { scene: unknown }).scene).toBeNull())
    await expect(canvas.getByTestId('active')).toHaveTextContent('none')
  },
}

/** A game joined during the session shows its stage at once, without a reload. */
export const JoinedGameShowsItsStage: Story = {
  decorators: [withStores({})],
  loaders: [seed, atRoute('/')],
  play: async () => {
    seedRecords('games', [{ id: olden.id, name: olden.name, master: olden.master, invite_code: olden.inviteCode }])
    seedRecords('stages', [{
      id: olden.id,
      game: olden.id,
      data: {
        id: olden.id,
        scene: { id: 'story-scene-other', image: { collection: 'scenes', record: 'story-scene-other', name: 'image.png' }, sound: null },
        image: null,
        sound: null,
      },
    }])
    await expect(useStageStore().stageOf(olden.id).scene).toBeNull()
    await loadGame(olden.id)
    await expect(useStageStore().stageOf(olden.id).scene?.id).toBe('story-scene-other')
  },
}

/** No stage row yet (the master never published): joining still works and shows nothing. */
export const JoinedGameWithoutStage: Story = {
  decorators: [withStores({})],
  loaders: [seed, atRoute('/')],
  play: async () => {
    seedRecords('games', [{ id: olden.id, name: olden.name, master: olden.master, invite_code: olden.inviteCode }])
    await loadGame(olden.id)
    await expect(useGamesStore().byId(olden.id)).toBeTruthy()
    await expect(useStageStore().stageOf(olden.id).scene).toBeNull()
  },
}
