import { computed, ref, readonly, shallowReactive, watch, type Ref } from 'vue'

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
  /** Fires when the track stops being audible for a reason the service did not ask for: an error after start, a pause from outside, the context leaving `running`. */
  onInterrupted(listener: () => void): void
  dispose(): void
}

export interface SceneAudioDeps {
  createTrack(src: string, loop: boolean): Track
  wait(seconds: number): Promise<void>
  setMasterVolume(level: number): void
  /** Called inside a user gesture: resumes the context, primes the pooled elements, and resolves true when audio may play. Not bounded by a timer. */
  unlock(): Promise<boolean>
  /** Suspends the context when nothing is playing and nothing is wanted. */
  idle(): void
  /** Calls `callback` once, from inside the next user gesture anywhere on the page; returns the remover. */
  addGestureListener(callback: () => void): () => void
}

export const SCENE_FADE_SECONDS = 2
/** How long the mixer stays silent before it lets the context sleep, so a quick next request does not thrash. */
export const IDLE_DELAY_SECONDS = 2

export interface SceneAudio {
  readonly blocked: Readonly<Ref<boolean>>
  setVolume(level: number): void
  /** Crossfades to `src` once it can play; null fades to silence. The latest call wins. */
  setScene(src: string | null): void
  /** After a gesture: clears `blocked`, starts a refused scene and resumes an interrupted one where it stopped. */
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
  /** A refused or interrupted track waits for a gesture. Never true while held. */
  readonly blocked: Readonly<Ref<boolean>>
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

/** The channels of one output, with the state they share: blocked, the gesture listener, idling. */
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
  /** Interrupted, or its resume was refused: waits for an unlock. */
  stalled: boolean
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

// Every awaited step checks `generation`, so only the latest request touches tracks.
function createChannel(deps: SceneAudioDeps, book: TrackBook): Channel {
  let generation = 0
  let current: Playing | null = null
  let incoming: Pending | null = null
  let requested: string | null = null
  let held = false
  let holdToken = 0
  const blocked = ref(false)
  const endedListeners: Array<(key: string) => void> = []

  function sync() {
    blocked.value = !held && (!!incoming?.refused || !!current?.stalled)
  }

  function fadeOut(track: Track, seconds: number) {
    track.fadeTo(0, seconds)
    void deps.wait(seconds).then(() => {
      track.pause()
      book.release(track)
    })
  }

  function dropCurrent(seconds: number) {
    if (current) fadeOut(current.track, seconds)
    current = null
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
    track.onInterrupted(() => {
      if (current?.track !== track) return
      current.stalled = true
      sync()
    })
    track.onEnded(() => {
      if (current?.track !== track) return
      const { key } = current.req
      current = null
      if (requested === key) requested = null
      book.release(track)
      sync()
      endedListeners.forEach(listener => listener(key))
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
    current = { track: p.track, req: p.req, stalled: false, paused: false }
    if (held) {
      p.track.pause()
      current.paused = true
    } else {
      p.track.fadeTo(1, fade)
    }
    if (previous) fadeOut(previous.track, fade)
    sync()
  }

  async function resumeCurrent(c: Playing, fade: number) {
    c.stalled = false
    sync()
    try {
      await c.track.play()
    } catch (e) {
      if (current !== c) return
      if (isRefusal(e)) {
        c.stalled = true
      } else {
        current = null
        if (requested === c.req.key) requested = null
        book.release(c.track)
      }
      sync()
      return
    }
    if (current !== c) return
    if (held) {
      c.track.pause()
      c.paused = true
      return
    }
    c.paused = false
    c.track.fadeTo(1, fade)
  }

  return {
    blocked: readonly(blocked),
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
        c.track.fadeTo(0, fade)
        void deps.wait(fade).then(() => {
          if (token !== holdToken || current !== c) return
          c.track.pause()
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
      if (c && (c.paused || c.stalled)) void resumeCurrent(c, fade)
      else c?.track.fadeTo(1, fade)
      sync()
    },
    resume() {
      if (held) return
      if (incoming?.ready && incoming.refused) void start(incoming, generation)
      else if (current?.stalled) void resumeCurrent(current, current.req.fade)
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
  const live = new Set<Track>()
  let idleToken = 0
  let removeGesture: (() => void) | null = null

  const book: TrackBook = {
    create(src, loop) {
      idleToken++
      const track = deps.createTrack(src, loop)
      live.add(track)
      return track
    },
    release(track) {
      if (!live.delete(track)) return
      track.dispose()
      if (live.size === 0) scheduleIdle()
    },
  }

  // Checked a microtask later, so a track released and replaced in one step never counts as silence.
  function scheduleIdle() {
    const token = ++idleToken
    queueMicrotask(() => {
      if (token !== idleToken || live.size > 0) return
      void deps.wait(IDLE_DELAY_SECONDS).then(() => {
        if (token === idleToken && live.size === 0) deps.idle()
      })
    })
  }

  function listenForGesture() {
    if (blocked.value && !removeGesture) {
      removeGesture = deps.addGestureListener(() => {
        removeGesture = null
        void unlock()
      })
    } else if (!blocked.value && removeGesture) {
      removeGesture()
      removeGesture = null
    }
  }

  async function unlock() {
    const allowed = await deps.unlock()
    if (allowed) channels.forEach(c => c.resume())
    listenForGesture()
  }

  watch(blocked, listenForGesture, { flush: 'sync' })

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
