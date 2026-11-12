import { defineComponent } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor as waitForDefault } from 'storybook/test'
import { useMediaSession } from '@/composables/useMediaSession'
import { useStagePlayback } from '@/composables/useStagePlayback'
import { emptyStage, overlayKey } from '@/domain/stage'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { withMediaPrefs } from '@/stories/playback'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import type { StageSound } from '@/types/stage'
import { closeMedia } from '@/transport/media'
import { fireOverlayEnded, sceneAudioCalls } from '../../../.storybook/mocks/sceneAudioInstance'
import { clearPbRequests, pbRequests, resetRecords, signInMock, storedRecords } from '../../../.storybook/mocks/pb'

// A slow runner takes longer than the default second.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

// What app.vue does for the table, without the layout: the playback and, for a master, the media session.
const Table = defineComponent({
  setup() {
    useMediaStore().clearAll()
    useMediaSession()
    useStagePlayback()
    return { closeMedia }
  },
  unmounted() { closeMedia() },
  template: '<p>The table</p>',
})

const meta = {
  title: 'Features/Stage/OverlayPlayback',
  component: Table,
  tags: ['no-visual'],
  parameters: { layout: 'padded' },
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const asPlayer = withGameTable(olden, [], {})
const MASTER_GAME = crookhollow.id
const PLAYER_GAME = olden.id

const SOUND_ID = 'story-sound-bell'

/** The clock the app reads (the preview freezes it): call it when the story runs, not when the file loads. */
const secondsFromNow = (seconds: number) => new Date(new Date().getTime() + seconds * 1000).toISOString()

function stageSound(over: Partial<StageSound> = {}, id = SOUND_ID): StageSound {
  return {
    id,
    file: { collection: 'sounds', record: id, name: 'sound.mp3' },
    loop: false,
    startedAt: secondsFromNow(0),
    ...over,
  }
}

const soundUrl = (id = SOUND_ID) => `http://127.0.0.1:8090/api/files/sounds/${id}/sound.mp3`

function show(game: string, sound: StageSound | null) {
  useStageStore().set({ ...emptyStage(game), sound })
}

/** The stage the table was opened on, as the snapshot would have loaded it (before the table mounts). */
function withStageOnLoad(game: string, sound: (() => StageSound) | null): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const stages = useStageStore()
      stages.clearAll()
      if (sound) show(game, sound())
    },
    template: '<story />',
  })
}

const seed = (duration: number | null) => async () => {
  clearPbRequests()
  resetRecords('stages')
  resetRecords('sounds', [{
    id: SOUND_ID,
    game: MASTER_GAME,
    data: { id: SOUND_ID, name: 'Bell', loop: false, ...(duration === null ? {} : { duration }) },
    file: 'sound.mp3',
  }])
}

const overlayCalls = () => sceneAudioCalls.flatMap(c => (c.method === 'setOverlay' ? [c.overlay] : []))
const overlayUrls = () => overlayCalls().flatMap(o => (o ? [o.src] : []))
const stageWrites = () => pbRequests().filter(r => r.startsWith('stages.') && !r.endsWith('subscribe') && !r.endsWith('getFullList'))
const storedSound = () => (storedRecords('stages')[0]?.data as { sound: unknown } | undefined)?.sound
const settle = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))
const filesRequested = () => performance.getEntriesByType('resource').filter(e => e.name.includes('/api/files/')).length

/** A sound that arrives while the table is open reaches the audio service under its key; a player writes nothing. */
export const PlayerGetsALiveSound: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await settle()
    await expect(overlayUrls()).toEqual([])
    const sound = stageSound({ loop: true })
    show(PLAYER_GAME, sound)
    await waitFor(() => expect(overlayCalls().at(-1)).toEqual({ key: overlayKey(sound), src: soundUrl(), loop: true }))
    fireOverlayEnded(overlayKey(sound))
    await settle()
    await expect(stageWrites()).toEqual([])
    await expect(useStageStore().stageOf(PLAYER_GAME).sound).toEqual(sound)
  },
}

/** A replay is a new key, even for the same sound, and a stop sends null. */
export const ReplayGetsANewKeyAndStopSendsNull: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    const first = stageSound({ startedAt: secondsFromNow(0) })
    show(PLAYER_GAME, first)
    await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(first)))
    const again = stageSound({ startedAt: secondsFromNow(1) })
    show(PLAYER_GAME, again)
    await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(again)))
    await expect(overlayKey(again)).not.toBe(overlayKey(first))
    show(PLAYER_GAME, null)
    await waitFor(() => expect(overlayCalls().at(-1)).toBeNull())
    await expect(stageWrites()).toEqual([])
  },
}

/** Sound off: the overlay never gets a URL and the file is not requested. */
export const SoundOffMeansNoOverlayRequest: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'off' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    const before = filesRequested()
    show(PLAYER_GAME, stageSound({ loop: true }))
    await settle()
    await expect(overlayUrls()).toEqual([])
    await expect(filesRequested()).toBe(before)
  },
}

/** Found in the stage on load: a looping sound plays, a one-shot older than the stale window does not. */
export const FoundOnLoadLoopPlays: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, () => stageSound({ loop: true, startedAt: secondsFromNow(-3600) })), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
  },
}

export const FoundOnLoadStaleOneShotIsSkipped: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, () => stageSound({ startedAt: secondsFromNow(-60) })), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await settle()
    await expect(overlayUrls()).toEqual([])
    // Nothing starts it later, and a player never clears it.
    await settle(2200)
    await expect(overlayUrls()).toEqual([])
    await expect(stageWrites()).toEqual([])
    await expect(useStageStore().stageOf(PLAYER_GAME).sound).not.toBeNull()
  },
}

/** A fresh one-shot found on load still plays. */
export const FoundOnLoadFreshOneShotPlays: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, () => stageSound({ startedAt: secondsFromNow(-1) })), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
  },
}

/** The master's own device reports the end: the stage is cleared. */
export const MasterClearsWhenTheOverlayEnds: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    const sound = stageSound()
    show(MASTER_GAME, sound)
    await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(sound)))
    await expect(stageWrites()).toEqual([])
    fireOverlayEnded(overlayKey(sound))
    await waitFor(() => expect(useStageStore().stageOf(MASTER_GAME).sound).toBeNull())
    await waitFor(() => expect(storedSound()).toBeNull())
  },
}

/** Sound off here: the timer from the sound's duration clears it. */
export const MasterClearsByTimerWithSoundOff: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'off' }), asMaster],
  loaders: [seed(0.2), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    show(MASTER_GAME, stageSound())
    await expect(overlayUrls()).toEqual([])
    await waitFor(() => expect(storedSound()).toBeNull())
    await expect(useStageStore().stageOf(MASTER_GAME).sound).toBeNull()
  },
}

/** A one-shot already overdue when the master opens the table is cleared without playing. */
export const MasterClearsAnOverdueOneShotFoundOnLoad: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, () => stageSound({ startedAt: secondsFromNow(-600) })), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(3), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(storedSound()).toBeNull())
    await expect(overlayUrls()).toEqual([])
  },
}

/** The stage moved on to another overlay: neither the timer nor an ended report of the old one touches it. */
export const MasterDoesNotClearWhenTheStageMovedOn: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'off' }), asMaster],
  loaders: [seed(0.2), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    const old = stageSound()
    show(MASTER_GAME, old)
    const next = stageSound({ loop: true, startedAt: secondsFromNow(1) }, 'story-sound-other')
    show(MASTER_GAME, next)
    fireOverlayEnded(overlayKey(old))
    await settle(2800)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(next)
    await expect(stageWrites()).toEqual([])
  },
}

/** A looping sound is never cleared by the master's client. */
export const MasterNeverClearsALoop: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'off' }), asMaster],
  loaders: [seed(0.2), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    show(MASTER_GAME, stageSound({ loop: true, startedAt: secondsFromNow(-600) }))
    await settle(2800)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).not.toBeNull()
    await expect(stageWrites()).toEqual([])
  },
}
