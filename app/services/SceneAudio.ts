import { ref, readonly, type Ref } from 'vue'

export interface Track {
  /** Resolves when the track can play through; rejects when it cannot load. */
  readonly ready: Promise<void>
  /** Resolves once playing; rejects with a DOMException named NotAllowedError when the browser wants a gesture. */
  play(): Promise<void>
  pause(): void
  /** Ramps this track's gain to `level` (0..1) over `seconds`. */
  fadeTo(level: number, seconds: number): void
  dispose(): void
}

export interface SceneAudioDeps {
  createTrack(src: string, loop: boolean): Track
  wait(seconds: number): Promise<void>
  setMasterVolume(level: number): void
  /** Called inside a user gesture; true when audio may play now. */
  unlock(): Promise<boolean>
}

export const SCENE_FADE_SECONDS = 2

export interface SceneAudio {
  readonly blocked: Readonly<Ref<boolean>>
  setVolume(level: number): void
  /** Crossfades to `src` once it can play; null fades to silence. The latest call wins. */
  setScene(src: string | null): void
  /** After a gesture: clears `blocked` and starts the current scene sound from its beginning. */
  unlock(): Promise<void>
  /** Fades everything out and releases every track. */
  stop(): void
}

interface Channel {
  set(src: string | null): void
  resume(): void
  stop(): void
}

// One looping-sound slot: at most one audible track plus one incoming track.
// Every awaited step checks `generation`, so only the latest set() touches tracks.
function createChannel(deps: SceneAudioDeps, loop: boolean, blocked: Ref<boolean>): Channel {
  let generation = 0
  let current: Track | null = null
  let currentSrc: string | null = null
  let incoming: Track | null = null
  let requested: string | null = null

  function fadeOut(track: Track) {
    track.fadeTo(0, SCENE_FADE_SECONDS)
    void deps.wait(SCENE_FADE_SECONDS).then(() => {
      track.pause()
      track.dispose()
    })
  }

  function dropIncoming() {
    incoming?.dispose()
    incoming = null
  }

  function fail() {
    dropIncoming()
    requested = currentSrc
  }

  async function start(track: Track, src: string, gen: number) {
    try {
      await track.play()
    } catch (e) {
      if (gen !== generation) return
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        blocked.value = true
        return
      }
      fail()
      return
    }
    if (gen !== generation) return
    blocked.value = false
    const previous = current
    current = track
    currentSrc = src
    incoming = null
    track.fadeTo(1, SCENE_FADE_SECONDS)
    if (previous) fadeOut(previous)
  }

  return {
    set(src) {
      if (src === requested) return
      requested = src
      const gen = ++generation
      dropIncoming()
      if (src === null) {
        blocked.value = false
        if (current) fadeOut(current)
        current = null
        currentSrc = null
        return
      }
      const track = deps.createTrack(src, loop)
      incoming = track
      track.ready.then(
        () => { if (gen === generation) return start(track, src, gen) },
        () => { if (gen === generation) fail() },
      )
    },
    resume() {
      if (incoming && requested) void start(incoming, requested, generation)
    },
    stop() {
      generation++
      requested = null
      blocked.value = false
      dropIncoming()
      if (current) fadeOut(current)
      current = null
      currentSrc = null
    },
  }
}

export function createSceneAudio(deps: SceneAudioDeps): SceneAudio {
  const blocked = ref(false)
  const scene = createChannel(deps, true, blocked)

  return {
    blocked: readonly(blocked),
    setVolume(level) {
      deps.setMasterVolume(Math.min(1, Math.max(0, level)))
    },
    setScene: src => scene.set(src),
    async unlock() {
      const allowed = await deps.unlock()
      if (!allowed || !blocked.value) return
      blocked.value = false
      scene.resume()
    },
    stop: () => scene.stop(),
  }
}
