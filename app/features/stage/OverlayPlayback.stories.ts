import { defineComponent } from 'vue'
import { ClientResponseError } from 'pocketbase'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import MasterTools from '@/components/layout/MasterTools.vue'
import SoundsPanel from './SoundsPanel.vue'
import { useMediaSession } from '@/composables/useMediaSession'
import { useStagePlayback } from '@/composables/useStagePlayback'
import { emptyStage, overlayKey, withScene } from '@/domain/stage'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { withMediaPrefs } from '@/stories/playback'
import { SCENES } from '@/stories/scenes'
import { storyRouter } from '@/stories/router'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { useMediaStore } from '@/stores/media'
import { useToastsStore } from '@/stores/toasts'
import { useStageStore } from '@/stores/stage'
import type { StageSound } from '@/types/stage'
import { connection } from '@/transport/connection'
import { closeMedia } from '@/transport/media'
import { publishStage } from '@/transport/stage'
import { fireOverlayEnded, sceneAudioCalls } from '../../../.storybook/mocks/sceneAudioInstance'
import { clearPbRequests, failWrites, pb, pbRequests, resetRecords, signInMock, storedRecords } from '../../../.storybook/mocks/pb'

// A slow runner takes longer than the default second.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

// The real grace after a one-shot ended is 15 s; the stories use a shorter one through the composable's own option.
const STORY_GRACE_SECONDS = 2.5
const STORY_GRACE_MS = STORY_GRACE_SECONDS * 1000

// What app.vue does for the table, without the layout: the playback and, for a master, the media session.
const Table = defineComponent({
  setup() {
    useMediaStore().clearAll()
    useMediaSession()
    useStagePlayback({ clearGraceSeconds: STORY_GRACE_SECONDS })
    return { closeMedia }
  },
  unmounted() { closeMedia() },
  template: '<p>The table</p>',
})

// The same, with the master's Sounds panel and tools, whose rows follow what plays here.
const TableWithSounds = defineComponent({
  components: { MasterTools, SoundsPanel },
  setup() {
    useMediaStore().clearAll()
    useMediaSession()
    useStagePlayback({ clearGraceSeconds: STORY_GRACE_SECONDS })
    return { game: crookhollow }
  },
  unmounted() { closeMedia() },
  template: '<div style="width: 420px; height: 480px"><SoundsPanel /></div><div style="width: 280px"><MasterTools :game="game" /></div>',
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

/** The preview freezes the clock: moves what the app reads forward by `ms`. Call the result to put the clock back. */
function advanceClock(ms: number): () => void {
  const Previous = globalThis.Date
  globalThis.Date = class extends Previous {
    constructor(...args: ConstructorParameters<DateConstructor> | []) {
      if (args.length === 0) super(Previous.now() + ms)
      else super(...(args as ConstructorParameters<DateConstructor>))
    }

    static override now() {
      return Previous.now() + ms
    }
  } as DateConstructor
  return () => { globalThis.Date = Previous }
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
      if (sound) stages.set({ ...emptyStage(game), sound: sound() }, 'load')
    },
    template: '<story />',
  })
}

const seed = (duration: number | null) => async () => {
  failWrites(null)
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

const armCalls = () => sceneAudioCalls.filter(c => c.method === 'arm')
const lastArming = () => sceneAudioCalls.filter(c => c.method === 'arm' || c.method === 'disarm').at(-1)?.method

/** Sound on at an open table: the audio service is armed, so the first tap primes it before any sound arrives. */
export const SoundOnArmsTheAudio: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(armCalls().length).toBeGreaterThan(0))
    await expect(overlayUrls()).toEqual([])
  },
}

/** Sound off or not chosen yet: nothing is armed (the prompt's button primes an `unset` device); turning it on arms. */
export const SoundOffOrUnsetDoesNotArm: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'unset' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    const prefs = useMediaPrefsStore()
    await settle()
    await expect(armCalls()).toEqual([])
    prefs.sound = 'off'
    await settle()
    await expect(armCalls()).toEqual([])
    prefs.sound = 'on'
    await waitFor(() => expect(armCalls()).toHaveLength(1))
  },
}

/**
 * Leaving the table, or turning sound off, disarms: a device that left without a tap keeps no listener that would prime
 * the audio on the first tap elsewhere. Coming back arms again.
 */
export const LeavingTheTableDisarms: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(lastArming()).toBe('arm'))
    await storyRouter.push('/games')
    await waitFor(() => expect(lastArming()).toBe('disarm'))
    await storyRouter.push(`/games/${PLAYER_GAME}`)
    await waitFor(() => expect(lastArming()).toBe('arm'))
    useMediaPrefsStore().sound = 'off'
    await waitFor(() => expect(lastArming()).toBe('disarm'))
  },
}

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
    // A direct switch: the service is never told null between the two keys, so the scene never comes back in between.
    const keys = overlayCalls().map(o => o?.key ?? null)
    await expect(keys.slice(keys.indexOf(overlayKey(first)))).toEqual([overlayKey(first), overlayKey(again)])
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
    show(PLAYER_GAME, stageSound({ loop: true }))
    await settle()
    await expect(overlayUrls()).toEqual([])
    await expect(overlayCalls().every(o => o === null)).toBe(true)
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
    // Nothing starts it later: not time, not an echo of the same stage arriving live, not sound turned off and on.
    const stages = useStageStore()
    const prefs = useMediaPrefsStore()
    await settle(800)
    stages.set(JSON.parse(JSON.stringify(stages.stageOf(PLAYER_GAME))), 'live')
    prefs.sound = 'off'
    await settle()
    prefs.sound = 'on'
    await settle(500)
    await expect(overlayUrls()).toEqual([])
    // And a player never clears it.
    await expect(stages.stageOf(PLAYER_GAME).sound).not.toBeNull()
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
    // Not at once: the clear waits the grace after the end, so a device that started late still hears the whole cue.
    await settle(STORY_GRACE_MS / 2)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(sound)
    await expect(stageWrites()).toEqual([])
    await waitFor(() => expect(useStageStore().stageOf(MASTER_GAME).sound).toBeNull())
    await waitFor(() => expect(storedSound()).toBeNull())
  },
}

/**
 * Sound off here: the clock clears it, at its start plus the duration plus at least 30 s. Started 29 s ago with a
 * duration of 0.2 s, the clear is due about 1.2 s from now: not at once, but soon.
 */
export const MasterClearsByTimerWithSoundOff: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'off' }), asMaster],
  loaders: [seed(0.2), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    show(MASTER_GAME, stageSound({ startedAt: secondsFromNow(-29) }))
    await settle(400)
    await expect(overlayUrls()).toEqual([])
    await expect(stageWrites()).toEqual([])
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
    await settle(4200)
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
    await settle(4200)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).not.toBeNull()
    await expect(stageWrites()).toEqual([])
  },
}

/** The master's own device is the player here: if the master check were gone, this stale one-shot would be cleared. */
export const NoClearWithoutBeingTheMaster: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, () => stageSound({ startedAt: secondsFromNow(-7200) })), withMediaPrefs({ sound: 'off' }), asPlayer],
  loaders: [seed(0.2), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    // Overdue by any rule (duration 0.2 s, an hour or two ago): a master's client clears it at once.
    await settle(4200)
    await expect(stageWrites()).toEqual([])
    await expect(useStageStore().stageOf(PLAYER_GAME).sound).not.toBeNull()
  },
}

/** A reconnect snapshot that brings a new one-shot older than the stale window: found, not played. */
export const ReconnectSnapshotWithANewStaleOneShotIsNotPlayed: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    await settle()
    useStageStore().set({ ...emptyStage(PLAYER_GAME), sound: stageSound({ startedAt: secondsFromNow(-60) }) }, 'load')
    await settle(500)
    await expect(overlayUrls()).toEqual([])
    // The same key from a later snapshot changes nothing, and a looping one found in a snapshot keeps playing.
    const loop = stageSound({ loop: true, startedAt: secondsFromNow(-60) }, 'story-sound-loop')
    useStageStore().set({ ...emptyStage(PLAYER_GAME), sound: loop }, 'load')
    await waitFor(() => expect(overlayUrls()).toEqual([soundUrl('story-sound-loop')]))
    useStageStore().set({ ...emptyStage(PLAYER_GAME), sound: loop }, 'load')
    await settle(300)
    await expect(overlayCalls().filter(Boolean)).toHaveLength(1)
  },
}

/**
 * A one-shot arrives live while sound is off, then a live scene change follows, and sound is turned on only after more
 * than the stale window: it is not played. (The scene change must not refresh the one-shot's first-seen time.)
 */
export const SoundTurnedOnLateSkipsTheOneShot: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'off' }), asPlayer],
  loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
  play: async () => {
    const stages = useStageStore()
    show(PLAYER_GAME, stageSound())
    await settle()
    const restore = advanceClock(4000)
    try {
        stages.set(withScene(stages.stageOf(PLAYER_GAME), SCENES[1]!))
        await settle()
        // 4 s after the sound arrived the scene changed (a fresh store time); sound on 8 s after the arrival.
        restore()
        const later = advanceClock(8000)
        try {
          useMediaPrefsStore().sound = 'on'
          await settle(400)
        } finally {
          later()
        }
      } finally {
        restore()
      }
      await expect(overlayUrls()).toEqual([])
      await expect(stages.stageOf(PLAYER_GAME).sound).not.toBeNull()
    },
  }

  /** A one-shot found stale on load, then a live scene change, then sound on: still found, still not played. */
  export const FoundStaleOneShotIsNotMadeLiveByASceneChange: Story = {
    decorators: [withStageOnLoad(PLAYER_GAME, () => stageSound({ startedAt: secondsFromNow(-60) })), withMediaPrefs({ sound: 'off' }), asPlayer],
    loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
    play: async () => {
      const stages = useStageStore()
      await settle()
      stages.set(withScene(stages.stageOf(PLAYER_GAME), SCENES[1]!))
      await settle()
      useMediaPrefsStore().sound = 'on'
      await settle(400)
      await expect(overlayUrls()).toEqual([])
    },
  }

  export const SoundTurnedOnSoonStillPlays: Story = {
    decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'off' }), asPlayer],
    loaders: [seed(null), atRoute(`/games/${PLAYER_GAME}`)],
    play: async () => {
      show(PLAYER_GAME, stageSound())
      await settle(400)
      useMediaPrefsStore().sound = 'on'
      await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
    },
  }

  /** The clear's write fails and the rollback brings the key back: the finished sound is not played again. */
  export const FailedClearDoesNotReplay: Story = {
    decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
    loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
    play: async () => {
      await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
      const sound = stageSound()
      show(MASTER_GAME, sound)
      await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
      failWrites('stages')
      try {
        fireOverlayEnded(overlayKey(sound))
        // One write, an update or (on a fresh page that has not seen the row) a create.
        await waitFor(() => expect(stageWrites()).toHaveLength(1))
        await settle(500)
        // Rolled back: the key is in the stage again, and was not played a second time.
        await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(sound)
        await expect(overlayUrls()).toEqual([soundUrl()])
        await expect(useToastsStore().items).toHaveLength(0)
      } finally {
        failWrites(null)
      }
    },
  }

  /**
   * A failed clear is tried once more after the grace, then not again by itself (no loop); the connection coming back
   * tries once more, and with the server answering again that one clears it.
   */
  export const FailedClearIsRetriedOnceAndOnReconnect: Story = {
    decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
    loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
    play: async () => {
      await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
      const sound = stageSound()
      show(MASTER_GAME, sound)
      await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
      failWrites('stages')
      try {
        fireOverlayEnded(overlayKey(sound))
        await waitFor(() => expect(stageWrites()).toHaveLength(1))
        await waitFor(() => expect(stageWrites()).toHaveLength(2))
        await settle(STORY_GRACE_MS + 800)
        await expect(stageWrites()).toHaveLength(2)
        await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(sound)
        await expect(useToastsStore().items).toHaveLength(0)
        failWrites(null)
        connection.value = 'checking'
        await settle(50)
        connection.value = 'ok'
        await waitFor(() => expect(storedSound()).toBeNull())
        await expect(useStageStore().stageOf(MASTER_GAME).sound).toBeNull()
        await expect(overlayUrls()).toEqual([soundUrl()])
      } finally {
        failWrites(null)
        connection.value = 'ok'
      }
    },
  }

  /**
   * A clear that comes due while another is on its way is not dropped: the first cue's clear is held on the network, the
   * master plays a second cue and it ends too; once the first write is over, the second is cleared (it has an unknown
   * duration and plays here, so no clock would ever clear it).
   */
  export const ClearDueDuringAnotherIsNotDropped: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    const stages = useStageStore()
    const rows = pb.collection('stages')
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    // Only the first write waits for the gate.
    let calls = 0
    const hold = <A extends unknown[], R>(real: (...args: A) => Promise<R>) => async (...args: A) => {
      if (calls++ === 0) await gate
      return real(...args)
    }
    const create = hold(rows.create)
    const update = hold(rows.update)
    const spies = [spyOn(rows, 'create').mockImplementation(create), spyOn(rows, 'update').mockImplementation(update)]
    try {
      const first = stageSound()
      show(MASTER_GAME, first)
      await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(first)))
      fireOverlayEnded(overlayKey(first))
      // The first clear is on its way, held.
      await waitFor(() => expect(calls).toBe(1))
      await expect(stages.stageOf(MASTER_GAME).sound).toBeNull()
      const second = stageSound({ startedAt: secondsFromNow(1) }, 'story-sound-second')
      void publishStage({ ...stages.stageOf(MASTER_GAME), sound: second })
      await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(second)))
      fireOverlayEnded(overlayKey(second))
      // Its clear comes due while the first is still held.
      await settle(STORY_GRACE_MS + 500)
      await expect(stages.stageOf(MASTER_GAME).sound).toEqual(second)
      release()
      // At once, not by a timer: the waiting clear runs when the first one is over.
      await waitFor(() => expect(storedSound()).toBeNull(), { timeout: 3000 })
      await expect(stages.stageOf(MASTER_GAME).sound).toBeNull()
      await expect(useToastsStore().items).toHaveLength(0)
    } finally {
      release()
      for (const spy of spies) spy.mockRestore()
    }
  },
}

/** Playing here with an unknown duration: nothing clears until the track ends, and then only after the grace. */
export const MasterPlayingAnUnknownDurationClearsOnlyAfterEnded: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(null), atRoute(`/games/${MASTER_GAME}`)],
  play: async () => {
    await waitFor(() => expect(useMediaStore().sounds.status).toBe('ready'))
    // Started long ago by its own clock but just arrived: it plays, and the old stale window must not cut it.
    const sound = stageSound({ startedAt: secondsFromNow(-30) })
    show(MASTER_GAME, sound)
    await waitFor(() => expect(overlayUrls()).toEqual([soundUrl()]))
    await settle(1500)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(sound)
    fireOverlayEnded(overlayKey(sound))
    await settle(STORY_GRACE_MS / 2)
    await expect(useStageStore().stageOf(MASTER_GAME).sound).toEqual(sound)
    await waitFor(() => expect(storedSound()).toBeNull())
  },
}

/** The master finds an overdue one-shot (skipped), its clear fails and rolls back: the key is never handed to the service. */
export const FailedClearOfAnOverdueOneShotNeverPlaysIt: Story = {
  decorators: [withStageOnLoad(MASTER_GAME, () => stageSound({ startedAt: secondsFromNow(-600) })), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(3), atRoute(`/games/${MASTER_GAME}`)],
  beforeEach() {
    failWrites('stages')
    return () => failWrites(null)
  },
  play: async () => {
    await waitFor(() => expect(pbRequests().some(r => r === 'stages.create' || r === 'stages.update')).toBe(true))
    await settle(600)
    // Rolled back (the write failed), and the key came back as a live value without being played.
    await expect(useStageStore().stageOf(MASTER_GAME).sound).not.toBeNull()
    await expect(overlayUrls()).toEqual([])
  },
}

/**
 * The master's row is back to Play when the cue ends here, although the stage holds the sound until the clear; the
 * Sounds row of the master's tools stops naming it. Play then plays it again at once, under a new key.
 */
export const RowIsBackToPlayWhenTheCueEnds: Story = {
  render: () => ({ components: { TableWithSounds }, template: '<TableWithSounds />' }),
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stages = useStageStore()
    await userEvent.click(await canvas.findByRole('button', { name: 'Play Bell' }))
    await waitFor(() => expect(stages.stageOf(MASTER_GAME).sound).not.toBeNull())
    const first = stages.stageOf(MASTER_GAME).sound!
    await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(first)))
    await expect(await canvas.findByRole('button', { name: 'Stop Bell' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Sounds, Bell is playing' })).toBeVisible()
    fireOverlayEnded(overlayKey(first))
    await expect(await canvas.findByRole('button', { name: 'Play Bell' })).toBeVisible()
    await expect(stages.stageOf(MASTER_GAME).sound).toEqual(first)
    await expect(canvas.queryByRole('button', { name: 'Sounds, Bell is playing' })).toBeNull()
    // The preview freezes the clock: a second later, so the new start is a new key.
    const restore = advanceClock(1000)
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Play Bell' }))
      await waitFor(() => expect(stages.stageOf(MASTER_GAME).sound?.startedAt).not.toBe(first.startedAt))
      const again = stages.stageOf(MASTER_GAME).sound!
      await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(again)))
      await expect(await canvas.findByRole('button', { name: 'Stop Bell' })).toBeVisible()
      await waitFor(() => expect((storedSound() as StageSound | undefined)?.startedAt).toBe(again.startedAt))
    } finally {
      restore()
    }
  },
}

/**
 * A cue that is over on the master's device but still on the stage (the clear comes later), deleted while the stage
 * refuses: the transport takes it off the table first, that fails, and the stage writer's message is the only one.
 */
export const DeleteOfAnOverCueRefusedByTheStage: Story = {
  render: () => ({ components: { TableWithSounds }, template: '<TableWithSounds />' }),
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'on' }), asMaster],
  loaders: [seed(42), atRoute(`/games/${MASTER_GAME}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stages = useStageStore()
    await userEvent.click(await canvas.findByRole('button', { name: 'Play Bell' }))
    await waitFor(() => expect(stages.stageOf(MASTER_GAME).sound).not.toBeNull())
    const cue = stages.stageOf(MASTER_GAME).sound!
    await waitFor(() => expect(overlayCalls().at(-1)?.key).toBe(overlayKey(cue)))
    fireOverlayEnded(overlayKey(cue))
    // Over here: the row offers Play again, while the stage still holds the cue.
    await expect(await canvas.findByRole('button', { name: 'Play Bell' })).toBeVisible()
    await expect(stages.stageOf(MASTER_GAME).sound).toEqual(cue)
    const spies = [
      spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 })),
      spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 })),
    ]
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Delete Bell' }))
      const confirm = await within(canvasElement.ownerDocument.body).findByRole('dialog')
      await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(useToastsStore().items.length).toBeGreaterThan(0))
      await settle(300)
      await expect(useToastsStore().items.map(t => t.text)).toEqual(['The change did not reach the table. Try again.'])
      await expect(pbRequests()).not.toContain('sounds.delete')
      await expect(canvas.getByRole('button', { name: 'Play Bell' })).toBeVisible()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  },
}

/** Sound off here, a cue of 1 s: the row is back to Play once the duration has passed, long before the clear. */
export const RowIsBackToPlayAfterTheDurationWithSoundOff: Story = {
  render: () => ({ components: { TableWithSounds }, template: '<TableWithSounds />' }),
  decorators: [withStageOnLoad(MASTER_GAME, null), withMediaPrefs({ sound: 'off' }), asMaster],
  loaders: [seed(1), atRoute(`/games/${MASTER_GAME}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Play Bell' }))
    await expect(await canvas.findByRole('button', { name: 'Stop Bell' })).toBeVisible()
    await expect(overlayUrls()).toEqual([])
    await expect(await canvas.findByRole('button', { name: 'Play Bell' }, { timeout: 3000 })).toBeVisible()
    await expect(useStageStore().stageOf(MASTER_GAME).sound).not.toBeNull()
  },
}

/**
 * A one-shot reached this device live, a minute later a live scene change, and only then the table opens: the sound
 * slot's arrival is the sound's own, not the scene change's, so the old one-shot is not played.
 */
export const StaleOneShotIsNotMadeFreshByALaterChange: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [seed(null), atRoute('/games')],
  play: async () => {
    const stages = useStageStore()
    stages.set({ ...emptyStage(PLAYER_GAME), sound: stageSound() }, 'live')
    const restore = advanceClock(60000)
    try {
      stages.set(withScene(stages.stageOf(PLAYER_GAME), SCENES[1]!), 'live')
      await storyRouter.push(`/games/${PLAYER_GAME}`)
      await settle(400)
      await expect(overlayUrls()).toEqual([])
      await expect(stages.stageOf(PLAYER_GAME).sound).not.toBeNull()
    } finally {
      restore()
    }
  },
}
