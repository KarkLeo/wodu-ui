import { computed, ref, readonly, shallowReactive, watch, type Ref } from 'vue'
import { createLogger } from '@/utils/logger'

const log = createLogger('audio')

/** Why a track stopped being audible: a pause from outside, the context leaving `running`, a media error after start. */
export type Interruption = 'paused' | 'suspended' | 'error'

/** No method throws. */
export interface Track {
  /** Resolves when the track can play through; rejects when it cannot load. */
  readonly ready: Promise<void>
  /** Resolves once playing; rejects with a DOMException named NotAllowedError when the browser wants a gesture. */
  play(): Promise<void>
  pause(): void
  /** Ramps this track's gain to `level` (0..1) over `seconds`, on an equal-power curve. */
  fadeTo(level: number, seconds: number): void
  /** Fires once when a non-looping track finishes by itself. */
  onEnded(listener: () => void): void
  /** Fires when the track stops being audible for a reason the service did not ask for. */
  onInterrupted(listener: (cause: Interruption) => void): void
  /** Fires when the browser brings an interrupted track back by itself. */
  onResumed(listener: () => void): void
  /** A pinned track (a channel's current or held one) keeps its element when the pool runs out. */
  pin(): void
  unpin(): void
  dispose(): void
}

export interface SceneAudioDeps {
  createTrack(src: string, loop: boolean): Track
  wait(seconds: number): Promise<void>
  setMasterVolume(level: number): void
  /** Called inside a user gesture: primes the pooled elements, resumes the context, and resolves true when audio may play. Not bounded by a timer. */
  unlock(): Promise<boolean>
  /** Calls `callback` from inside every user gesture anywhere on the page until the returned remover is called. */
  addGestureListener(callback: () => void): () => void
}

export const SCENE_FADE_SECONDS = 2
/** How long `unlock()` keeps its caller waiting; a resume still pending after that goes on in the background. */
export const UNLOCK_WAIT_SECONDS = 1

export interface SceneAudio {
  readonly blocked: Readonly<Ref<boolean>>
  setVolume(level: number): void
  /** Crossfades to `src` once it can play; null fades to silence. The latest call wins. */
  setScene(src: string | null): void
  /** After a gesture: starts a refused scene and resumes an interrupted one where it stopped. */
  unlock(): Promise<void>
  /** Fades everything out and releases every track. */
  stop(): void
}

/** What a channel should play. `key` is its identity: a new key restarts even the same `src`. */
export interface ChannelRequest {
  key: string
  src: string
  loop: boolean
  /** Seconds of the fade in, and of the crossfade that brings this request in. */
  fade: number
}

/** One sound slot: at most one audible track plus one incoming track. */
export interface Channel {
  /** A refused or interrupted track waits for an unlock. Never true while held. */
  readonly blocked: Readonly<Ref<boolean>>
  /** Blocked for a reason any tap can fix (a refused play, a suspended context), not by a deliberate pause from outside. */
  readonly tapHelps: Readonly<Ref<boolean>>
  /** The latest call wins; the same key again does nothing; null fades to silence. */
  request(next: ChannelRequest | null): void
  /** Fades the playing track out over `fade` and pauses it in place. A request meanwhile is prepared but kept silent. */
  hold(fade: number): void
  /** Ends a hold: a request prepared meanwhile comes in, otherwise the held track plays on from where it paused; both fade in over `fade`. */
  release(fade: number): void
  /** After an unlock: plays a refused track and resumes an interrupted one. */
  resume(): void
  stop(): void
  /** Called with the key of a non-looping track that finished by itself (not one stopped or replaced). */
  onEnded(listener: (key: string) => void): void
}

/** The channels of one output, with what they share: blocked, the gesture listener, the unlock. */
export interface AudioMixer {
  /** True while any channel is blocked. */
  readonly blocked: Readonly<Ref<boolean>>
  channel(): Channel
  setVolume(level: number): void
  unlock(): Promise<void>
  stop(): void
}

interface Playing {
  track: Track
  req: ChannelRequest
  /** Why it waits for an unlock: interrupted from outside, by the context, or a resume the browser refused. */
  stall: 'paused' | 'suspended' | 'refused' | null
  /** Paused by a hold. */
  paused: boolean
}

interface Pending {
  track: Track
  req: ChannelRequest
  ready: boolean
  /** Ready, but the browser refused its play: waits for an unlock. */
  refused: boolean
}

interface TrackBook {
  create(src: string, loop: boolean): Track
  /** Disposes a track once, however many paths reach it. */
  release(track: Track): void
}

const isRefusal = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError'

// A track that throws must not stop a transition half way: the state machine carries on as if the call had worked.
function safely(call: () => void) {
  try {
    call()
  } catch (e) {
    log.warn('track call failed', e)
  }
}

// Every awaited step checks `generation`, so only the latest request touches tracks.
function createChannel(deps: SceneAudioDeps, book: TrackBook): Channel {
  let generation = 0
  let current: Playing | null = null
  let incoming: Pending | null = null
  let requested: string | null = null
  let held = false
  let holdToken = 0
  const blocked = ref(false)
  const tapHelps = ref(false)
  const endedListeners: Array<(key: string) => void> = []

  function sync() {
    const refused = !!incoming?.refused
    const stall = current?.stall ?? null
    blocked.value = !held && (refused || stall !== null)
    tapHelps.value = !held && (refused || stall === 'suspended' || stall === 'refused')
  }

  function fadeOut(track: Track, seconds: number) {
    safely(() => track.unpin())
    safely(() => track.fadeTo(0, seconds))
    void deps.wait(seconds).then(() => {
      safely(() => track.pause())
      book.release(track)
    })
  }

  function makeCurrent(p: Pending): Playing {
    safely(() => p.track.pin())
    return { track: p.track, req: p.req, stall: null, paused: false }
  }

  function dropCurrent(seconds: number) {
    if (current) fadeOut(current.track, seconds)
    current = null
  }

  // The track is gone for good: its key may be asked for again.
  function forgetCurrent(c: Playing) {
    current = null
    if (requested === c.req.key) requested = null
    safely(() => c.track.unpin())
    book.release(c.track)
  }

  function dropIncoming() {
    if (incoming) book.release(incoming.track)
    incoming = null
  }

  function fail() {
    dropIncoming()
    requested = current?.req.key ?? null
    sync()
  }

  function watchTrack(track: Track) {
    track.onInterrupted(cause => {
      const c = current
      if (c?.track !== track) return
      if (cause === 'error') {
        // A tap cannot fix broken media: nothing is current, and the same src may be asked for again.
        log.warn(`playback failed: ${c.req.src}`)
        forgetCurrent(c)
      } else {
        c.stall = cause
      }
      sync()
    })
    track.onResumed(() => {
      const c = current
      if (c?.track !== track || !c.stall) return
      c.stall = null
      if (held && c.paused) safely(() => track.pause())
      sync()
    })
    track.onEnded(() => {
      const c = current
      if (c?.track !== track) return
      forgetCurrent(c)
      sync()
      endedListeners.forEach(listener => listener(c.req.key))
    })
  }

  async function start(p: Pending, gen: number, fade = p.req.fade) {
    p.refused = false
    sync()
    try {
      await p.track.play()
    } catch (e) {
      if (gen !== generation || incoming !== p) return
      if (isRefusal(e)) {
        p.refused = true
        // The table falls silent under the new picture rather than keeping the old scene's sound.
        dropCurrent(fade)
        sync()
        return
      }
      fail()
      return
    }
    if (gen !== generation || incoming !== p) return
    const previous = current
    incoming = null
    current = makeCurrent(p)
    if (held) {
      safely(() => p.track.pause())
      current.paused = true
    } else {
      safely(() => p.track.fadeTo(1, fade))
    }
    if (previous) fadeOut(previous.track, fade)
    sync()
  }

  async function resumeCurrent(c: Playing, fade: number) {
    c.stall = null
    sync()
    try {
      await c.track.play()
    } catch (e) {
      if (current !== c) return
      if (isRefusal(e)) c.stall = 'refused'
      else forgetCurrent(c)
      sync()
      return
    }
    if (current !== c) return
    if (held) {
      safely(() => c.track.pause())
      c.paused = true
      return
    }
    c.paused = false
    safely(() => c.track.fadeTo(1, fade))
  }

  return {
    blocked: readonly(blocked),
    tapHelps: readonly(tapHelps),
    request(next) {
      const key = next?.key ?? null
      if (key === requested) return
      requested = key
      const gen = ++generation
      dropIncoming()
      if (next && current?.req.key === next.key) {
        sync()
        return
      }
      // A held track is silent already, so it goes at once instead of waiting for the next one to be ready.
      if (current && (!next || held)) dropCurrent(current.req.fade)
      if (!next) {
        sync()
        return
      }
      const track = book.create(next.src, next.loop)
      const p: Pending = { track, req: next, ready: false, refused: false }
      incoming = p
      watchTrack(track)
      sync()
      track.ready.then(
        () => {
          if (gen !== generation) return
          p.ready = true
          if (!held) return start(p, gen)
        },
        () => { if (gen === generation) fail() },
      )
    },
    hold(fade) {
      if (held) return
      held = true
      const token = ++holdToken
      const c = current
      if (c && !c.paused) {
        safely(() => c.track.fadeTo(0, fade))
        void deps.wait(fade).then(() => {
          if (token !== holdToken || current !== c) return
          safely(() => c.track.pause())
          c.paused = true
        })
      }
      sync()
    },
    release(fade) {
      if (!held) return
      held = false
      holdToken++
      if (incoming?.ready) {
        void start(incoming, generation, fade)
        return
      }
      const c = current
      if (c && (c.paused || c.stall)) void resumeCurrent(c, fade)
      else if (c) safely(() => c.track.fadeTo(1, fade))
      sync()
    },
    resume() {
      if (held) return
      if (incoming?.ready && incoming.refused) void start(incoming, generation)
      else if (current?.stall) void resumeCurrent(current, current.req.fade)
    },
    stop() {
      generation++
      requested = null
      held = false
      holdToken++
      dropIncoming()
      dropCurrent(current?.req.fade ?? 0)
      sync()
    },
    onEnded(listener) {
      endedListeners.push(listener)
    },
  }
}

export function createAudioMixer(deps: SceneAudioDeps): AudioMixer {
  const channels = shallowReactive<Channel[]>([])
  const blocked = computed(() => channels.some(c => c.blocked.value))
  const tapHelps = computed(() => channels.some(c => c.tapHelps.value))
  const live = new Set<Track>()
  let removeGesture: (() => void) | null = null

  const book: TrackBook = {
    create(src, loop) {
      const track = deps.createTrack(src, loop)
      live.add(track)
      return track
    },
    release(track) {
      if (live.delete(track)) safely(() => track.dispose())
    },
  }

  // Kept across gestures that did not help (a scroll's touchend may carry no activation); gone once nothing a tap fixes is left.
  watch(tapHelps, wanted => {
    if (wanted && !removeGesture) {
      removeGesture = deps.addGestureListener(() => { void unlock() })
    } else if (!wanted && removeGesture) {
      removeGesture()
      removeGesture = null
    }
  }, { flush: 'sync' })

  // The resume may stay pending (WebKit outside activation); the channels go on whenever it settles, the caller does not wait for it.
  function unlock(): Promise<void> {
    const attempt = deps.unlock().then(
      allowed => { if (allowed) channels.forEach(c => c.resume()) },
      e => { log.warn('unlock failed', e) },
    )
    return Promise.race([attempt, deps.wait(UNLOCK_WAIT_SECONDS)])
  }

  return {
    blocked,
    channel() {
      const channel = createChannel(deps, book)
      channels.push(channel)
      return channel
    },
    setVolume(level) {
      deps.setMasterVolume(Math.min(1, Math.max(0, level)))
    },
    unlock,
    stop() {
      channels.forEach(c => c.stop())
    },
  }
}

export function createSceneAudio(deps: SceneAudioDeps): SceneAudio {
  const mixer = createAudioMixer(deps)
  const scene = mixer.channel()

  return {
    blocked: mixer.blocked,
    setVolume: mixer.setVolume,
    setScene: src => scene.request(src === null ? null : { key: src, src, loop: true, fade: SCENE_FADE_SECONDS }),
    unlock: mixer.unlock,
    stop: mixer.stop,
  }
}
