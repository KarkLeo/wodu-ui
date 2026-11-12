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
import { connection } from '@/transport/connection'
import SceneSheet from './SceneSheet.vue'
import { soundFile } from '@/stories/scenes'
import { useStageControl } from '@/composables/useStageControl'
import { clearPbRequests, pbRequests, resetRecords, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'
import { holdUploads, sentForms } from '../../../.storybook/mocks/upload'

// Story-only harness: the session and the master's switches have no screen yet.
const Harness = defineComponent({
  setup() {
    const media = useMediaStore()
    media.clearAll()
    useStageStore().clearAll()
    useMediaSession()
    // The next story starts with nothing listening, as a fresh page would.
    onUnmounted(closeMedia)
    const { activeSceneId, turnOnScene, turnOffScene, playingSoundId, playSound, stopSound, shownImageId, showImage, hideImage } = useStageControl()
    return {
      media, activeSceneId, playingSoundId, shownImageId,
      on: () => turnOnScene(media.scenes.list[0]!),
      off: () => turnOffScene(),
      play: () => playSound(media.sounds.list[0]!),
      stop: () => stopSound(),
      showWith: () => showImage(media.images.list[0]!, true),
      showWithout: () => showImage(media.images.list[0]!, false),
      hide: () => hideImage(),
    }
  },
  template: `
    <div>
      <p data-testid="status">{{ media.scenes.status }}</p>
      <p data-testid="count">{{ media.scenes.list.length }}</p>
      <p data-testid="active">{{ activeSceneId ?? 'none' }}</p>
      <p data-testid="sounds-status">{{ media.sounds.status }}</p>
      <p data-testid="sounds-count">{{ media.sounds.list.length }}</p>
      <p data-testid="playing">{{ playingSoundId ?? 'none' }}</p>
      <p data-testid="images-status">{{ media.images.status }}</p>
      <p data-testid="images-count">{{ media.images.list.length }}</p>
      <p data-testid="shown">{{ shownImageId ?? 'none' }}</p>
      <button type="button" @click="showWith">Show with caption</button>
      <button type="button" @click="showWithout">Show without caption</button>
      <button type="button" @click="hide">Hide image</button>
      <button type="button" @click="on">On</button>
      <button type="button" @click="off">Off</button>
      <button type="button" @click="play">Play</button>
      <button type="button" @click="stop">Stop</button>
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
const SOUND_ID = 'story-sound-rain-01'
const IMAGE_ID = 'story-image-map-001'

const seed = async () => {
  clearPbRequests()
  resetRecords('stages')
  resetRecords('scenes', [
    { id: SCENE_ID, game: crookhollow.id, data: { id: SCENE_ID, name: 'Crypt' }, image: 'image.jpg', sound: 'sound.mp3' },
    { id: 'story-scene-other', game: olden.id, data: { id: 'story-scene-other', name: 'Tower' }, image: 'image.png', sound: '' },
  ])
  resetRecords('sounds', [
    { id: SOUND_ID, game: crookhollow.id, data: { id: SOUND_ID, name: 'Rain', loop: true, duration: 42 }, file: 'sound.mp3' },
    { id: 'story-sound-other-1', game: olden.id, data: { id: 'story-sound-other-1', name: 'Bell', loop: false }, file: 'sound.m4a' },
  ])
  resetRecords('images', [
    { id: IMAGE_ID, game: crookhollow.id, data: { id: IMAGE_ID, caption: 'The old map' }, file: 'image.png' },
    { id: 'story-image-other-1', game: olden.id, data: { id: 'story-image-other-1' }, file: 'image.jpg' },
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

/** The same open loads and listens to the sounds once, and only this game's. */
export const MasterOpensTheSounds: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('sounds-status')).toHaveTextContent('ready'))
    await expect(canvas.getByTestId('sounds-count')).toHaveTextContent('1')
    await flush()
    await expect(requestsFor('sounds').filter(r => r === 'sounds.getFullList')).toHaveLength(1)
    await expect(requestsFor('sounds').filter(r => r === 'sounds.subscribe')).toHaveLength(1)
  },
}

/** The same open loads and listens to the images once, and only this game's. */
export const MasterOpensTheImages: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByTestId('images-status')).toHaveTextContent('ready'))
    await expect(canvas.getByTestId('images-count')).toHaveTextContent('1')
    await flush()
    await expect(requestsFor('images').filter(r => r === 'images.getFullList')).toHaveLength(1)
    await expect(requestsFor('images').filter(r => r === 'images.subscribe')).toHaveLength(1)
  },
}

/** A player's client never asks for the scenes, sounds or images. */
export const PlayerNeverOpensThem: Story = {
  decorators: [asPlayer],
  loaders: [seed, atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await flush()
    await expect(canvas.getByTestId('status')).toHaveTextContent('idle')
    await expect(requestsFor('scenes')).toEqual([])
    await expect(canvas.getByTestId('sounds-status')).toHaveTextContent('idle')
    await expect(requestsFor('sounds')).toEqual([])
    await expect(canvas.getByTestId('images-status')).toHaveTextContent('idle')
    await expect(requestsFor('images')).toEqual([])
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

/** Play writes the stage's sound with the file reference, loop and start but no name; play again restarts it; stop clears it. */
export const PlayPlayAgainAndStop: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const soundOnStage = () => (storedRecords('stages')[0]?.data as { sound: { startedAt: string } | null } | undefined)?.sound
    await waitFor(() => expect(canvas.getByTestId('sounds-count')).toHaveTextContent('1'))
    await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(soundOnStage()).toBeTruthy())
    const first = soundOnStage()!
    await expect(first).toEqual({
      id: SOUND_ID,
      file: { collection: 'sounds', record: SOUND_ID, name: 'sound.mp3' },
      loop: true,
      startedAt: expect.any(String),
    })
    await expect(JSON.stringify(storedRecords('stages')[0]!.data)).not.toContain('Rain')
    await expect(canvas.getByTestId('playing')).toHaveTextContent(SOUND_ID)
    // The preview freezes the clock; the master presses Play again a second later.
    const Frozen = globalThis.Date
    globalThis.Date = class extends Frozen {
      constructor(...args: ConstructorParameters<DateConstructor> | []) {
        if (args.length === 0) super(Frozen.now() + 1000)
        else super(...(args as ConstructorParameters<DateConstructor>))
      }
    } as DateConstructor
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Play' }))
      await waitFor(() => expect(soundOnStage()!.startedAt > first.startedAt).toBe(true))
    } finally {
      globalThis.Date = Frozen
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(soundOnStage()).toBeNull())
    await expect(canvas.getByTestId('playing')).toHaveTextContent('none')
  },
}

/** Show writes the stage's image with the file reference and the chosen caption; showing again is a new reveal; hide clears it. */
export const ShowShowAgainAndHide: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const onStage = () => (storedRecords('stages')[0]?.data as { image: { caption: string | null; shownAt: string } | null } | undefined)?.image
    await waitFor(() => expect(canvas.getByTestId('images-count')).toHaveTextContent('1'))
    await userEvent.click(canvas.getByRole('button', { name: 'Show with caption' }))
    await waitFor(() => expect(onStage()).toBeTruthy())
    const first = onStage()!
    await expect(first).toEqual({
      id: IMAGE_ID,
      file: { collection: 'images', record: IMAGE_ID, name: 'image.png' },
      caption: 'The old map',
      shownAt: expect.any(String),
    })
    await expect(canvas.getByTestId('shown')).toHaveTextContent(IMAGE_ID)
    // The preview freezes the clock; the master shows it again a second later, this time without its caption.
    const Frozen = globalThis.Date
    globalThis.Date = class extends Frozen {
      constructor(...args: ConstructorParameters<DateConstructor> | []) {
        if (args.length === 0) super(Frozen.now() + 1000)
        else super(...(args as ConstructorParameters<DateConstructor>))
      }
    } as DateConstructor
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Show without caption' }))
      await waitFor(() => expect(onStage()!.shownAt > first.shownAt).toBe(true))
    } finally {
      globalThis.Date = Frozen
    }
    await expect(onStage()!.caption).toBeNull()
    await expect(JSON.stringify(storedRecords('stages')[0]!.data)).not.toContain('The old map')
    await userEvent.click(canvas.getByRole('button', { name: 'Hide image' }))
    await waitFor(() => expect(onStage()).toBeNull())
    await expect(canvas.getByTestId('shown')).toHaveTextContent('none')
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

// Story-only harness: the session with a scene sheet open on it, as the Scenes panel has it.
const SheetHarness = defineComponent({
  components: { SceneSheet },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    useStageStore().clearAll()
    useMediaSession()
    onUnmounted(() => {
      connection.value = 'ok'
      closeMedia()
    })
    return { gameId: crookhollow.id }
  },
  template: '<SceneSheet :open="true" :game-id="gameId" />',
})

/** The connection check going to `checking` and back does not cancel an upload under way: the sheet keeps its progress and closes when it is done. */
export const UploadSurvivesAConnectionBlip: Story = {
  decorators: [asMaster],
  loaders: [seed, atRoute(`/games/${crookhollow.id}`)],
  render: () => ({ components: { SheetHarness }, template: '<SheetHarness />' }),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const user = userEvent.setup({ applyAccept: false })
    await waitFor(() => expect(useMediaStore().scenes.status).toBe('ready'))
    const release = holdUploads()
    try {
      await user.type(await body.findByRole('textbox', { name: 'Name' }), 'Cellar')
      await user.upload(body.getByLabelText('Sound', { selector: 'input' }), soundFile())
      await user.click(body.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(body.getAllByRole('progressbar')).toHaveLength(1))
      connection.value = 'checking'
      await flush()
      await expect(body.getAllByRole('progressbar')).toHaveLength(1)
      connection.value = 'ok'
      await flush()
      await expect(body.getAllByRole('progressbar')).toHaveLength(1)
    } finally {
      release()
    }
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull())
    await expect(sentForms()).toHaveLength(1)
    await expect(useMediaStore().scenes.list.map(s => s.name)).toContain('Cellar')
    await expect(body.queryByRole('alert')).toBeNull()
  },
}
