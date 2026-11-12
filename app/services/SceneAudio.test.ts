import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createAudioMixer,
  createSceneAudio,
  OVERLAY_FADE_SECONDS,
  SCENE_FADE_SECONDS,
  UNLOCK_WAIT_SECONDS,
  type AudioMixer,
  type Interruption,
  type SceneAudio,
  type SceneAudioDeps,
  type Track,
} from './SceneAudio'

const warn = vi.hoisted(() => vi.fn())
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn, error: () => {} }),
}))

interface FakeTrack extends Track {
  src: string
  loop: boolean
  calls: string[]
  resolveReady(): void
  rejectReady(): void
  refusePlay(): void
  failPlay(): void
  /** The next play() stays pending until `settlePlay()`. */
  hangPlay(): void
  settlePlay(): void
  /** fadeTo, pause and dispose throw from now on, after recording the call. */
  breakAutomation(): void
  /** The browser stopped it; by default the context left `running`. */
  interrupt(cause?: Interruption): void
  /** The browser brought it back by itself after an interruption. */
  resumeByItself(): void
  /** A non-looping track reached its end. */
  finish(): void
  pinned: boolean
}

/** `allowed` models the browser: false makes a play() without its own override refuse, as an unprimed element would. */
function makeFakeTrack(src: string, loop: boolean, allowed: () => boolean = () => true): FakeTrack {
  let resolveReady!: () => void
  let rejectReady!: (e: Error) => void
  const ready = new Promise<void>((res, rej) => {
    resolveReady = res
    rejectReady = rej
  })
  ready.catch(() => {})
  const calls: string[] = []
  const interrupted: Array<(cause: Interruption) => void> = []
  const resumed: Array<() => void> = []
  const ended: Array<() => void> = []
  let playMode: 'ok' | 'refuse' | 'fail' | 'hang' = 'ok'
  let settle: (() => void) | null = null
  let broken = false
  const record = (call: string) => {
    calls.push(call)
    if (broken) throw new DOMException('overlaps a curve', 'NotSupportedError')
  }
  const t: FakeTrack = {
    src,
    loop,
    calls,
    ready,
    pinned: false,
    resolveReady: () => resolveReady(),
    rejectReady: () => rejectReady(new Error('load failed')),
    refusePlay: () => { playMode = 'refuse' },
    failPlay: () => { playMode = 'fail' },
    hangPlay: () => { playMode = 'hang' },
    settlePlay: () => settle?.(),
    breakAutomation: () => { broken = true },
    interrupt: (cause = 'suspended') => interrupted.forEach(l => l(cause)),
    resumeByItself: () => resumed.forEach(l => l()),
    finish: () => ended.forEach(l => l()),
    play() {
      calls.push('play')
      const mode = playMode
      playMode = 'ok'
      if (mode === 'refuse' || (mode === 'ok' && !allowed())) return Promise.reject(new DOMException('gesture needed', 'NotAllowedError'))
      if (mode === 'fail') return Promise.reject(new DOMException('bad media', 'NotSupportedError'))
      if (mode === 'hang') return new Promise<void>(resolve => { settle = resolve })
      return Promise.resolve()
    },
    pause() { record('pause') },
    fadeTo(level, seconds) { record(`fadeTo(${level},${seconds})`) },
    onEnded(listener) { ended.push(listener) },
    onInterrupted(listener) { interrupted.push(listener) },
    onResumed(listener) { resumed.push(listener) },
    pin() { t.pinned = true },
    unpin() { t.pinned = false },
    dispose() { record('dispose') },
  }
  return t
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

interface Harness {
  tracks: FakeTrack[]
  waits: Array<{ seconds: number, resolve: () => void }>
  masterVolumes: number[]
  unlockResult: boolean
  /** Set to make the next unlock() answer only when `answerUnlock(result)` is called. */
  unlockHangs: boolean
  answerUnlock: Array<(result: boolean) => void>
  unlockCalls: number
  /** The document-gesture listeners installed and not yet removed. */
  gestures: Array<() => void>
  gestureInstalls: number
  /** Models WebKit: an element plays without a gesture only after the pool was primed inside one. */
  needsPriming: boolean
  /** Whether an unlock primes the pool (false: the gesture carried no activation). */
  primeWorks: boolean
  primedPool: boolean
  deps: SceneAudioDeps
}

function harness(): Harness {
  const h: Harness = {
    tracks: [],
    waits: [],
    masterVolumes: [],
    unlockResult: true,
    unlockHangs: false,
    answerUnlock: [],
    unlockCalls: 0,
    gestures: [],
    gestureInstalls: 0,
    needsPriming: false,
    primeWorks: true,
    primedPool: false,
    deps: undefined as unknown as SceneAudioDeps,
  }
  h.deps = {
    createTrack(src, loop) {
      const t = makeFakeTrack(src, loop, () => !h.needsPriming || h.primedPool)
      h.tracks.push(t)
      return t
    },
    wait: seconds => new Promise<void>(resolve => { h.waits.push({ seconds, resolve }) }),
    setMasterVolume: level => { h.masterVolumes.push(level) },
    unlock() {
      h.unlockCalls++
      if (h.primeWorks) h.primedPool = true
      if (!h.unlockHangs) return Promise.resolve(h.unlockResult)
      return new Promise<boolean>(resolve => { h.answerUnlock.push(resolve) })
    },
    primed: () => h.primedPool,
    // Like the shell's: fires on every gesture until removed.
    addGestureListener(callback) {
      h.gestureInstalls++
      h.gestures.push(callback)
      return () => {
        const i = h.gestures.indexOf(callback)
        if (i >= 0) h.gestures.splice(i, 1)
      }
    },
  }
  return h
}

describe('SceneAudio', () => {
  let h: Harness
  let tracks: FakeTrack[]
  let waits: Harness['waits']
  let masterVolumes: number[]
  let audio: SceneAudio

  const track = (name: string) => {
    const found = tracks.filter(t => t.src === `${name}.mp3`).at(-1)
    if (!found) throw new Error(`no track ${name}`)
    return found
  }
  const advance = async (_seconds: number) => {
    const due = waits.splice(0)
    due.forEach(w => w.resolve())
    await flush()
  }
  // The waits that end fades, without the bound every unlock() puts on its own wait.
  const fadeWaits = () => waits.filter(w => w.seconds !== UNLOCK_WAIT_SECONDS)

  beforeEach(() => {
    warn.mockClear()
    h = harness()
    tracks = h.tracks
    waits = h.waits
    masterVolumes = h.masterVolumes
    audio = createSceneAudio(h.deps)
  })

  it('exposes a 2 second fade constant', () => {
    expect(SCENE_FADE_SECONDS).toBe(2)
  })

  it('creates a looping track at once, but changes nothing audible until it is ready', async () => {
    audio.setScene('a.mp3')
    await flush()
    expect(tracks).toHaveLength(1)
    expect(track('a').loop).toBe(true)
    expect(track('a').calls).toEqual([])
  })

  it('starts the incoming track only when it is ready, then fades it in and the old one out over 2 s', async () => {
    audio.setScene('a.mp3'); await flush()
    expect(track('a').calls).toEqual([])
    track('a').resolveReady(); await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    expect(waits.map(w => w.seconds)).toEqual([2])
    await advance(2)
    expect(track('a').calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('keeps the old track playing while the new one is still loading', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(track('b').calls).toEqual([])
  })

  it('the latest of three quick calls wins and the two never-heard tracks are disposed without playing', async () => {
    audio.setScene('a.mp3')
    audio.setScene('b.mp3')
    audio.setScene('c.mp3')
    await flush()
    expect(track('a').calls).toEqual(['dispose'])
    expect(track('b').calls).toEqual(['dispose'])
    track('a').resolveReady(); track('b').resolveReady(); await flush()
    expect(track('a').calls).toEqual(['dispose'])
    expect(track('b').calls).toEqual(['dispose'])
    track('c').resolveReady(); await flush()
    expect(track('c').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('setting the same src again does nothing', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('a.mp3'); await flush()
    expect(tracks).toHaveLength(1)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    audio.setScene('b.mp3'); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(tracks).toHaveLength(2)
  })

  it('null fades the current track out and disposes it; nothing is created', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene(null); await flush()
    expect(tracks).toHaveLength(1)
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    await advance(2)
    expect(track('a').calls.slice(-2)).toEqual(['pause', 'dispose'])
  })

  it('null while a track is still loading disposes it unheard', async () => {
    audio.setScene('a.mp3')
    audio.setScene(null); await flush()
    expect(track('a').calls).toEqual(['dispose'])
    track('a').resolveReady(); await flush()
    expect(track('a').calls).toEqual(['dispose'])
  })

  it('a track that fails to load is disposed and the current one keeps playing untouched', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').rejectReady(); await flush()
    expect(track('b').calls).toEqual(['dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(waits).toHaveLength(0)
    audio.setScene('c.mp3'); track('c').resolveReady(); await flush()
    expect(track('c').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
  })

  it('after a failed load the same src can be tried again', async () => {
    audio.setScene('b.mp3'); track('b').rejectReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(tracks).toHaveLength(2)
  })

  it('a play that fails for another reason is treated like a load failure', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').failPlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual(['play', 'dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  // Changed on purpose (Sounds plan, Task 1): the old scene's sound no longer keeps playing under the new picture.
  it('a refused play sets blocked and keeps the track, and the previous track fades out anyway; unlock() plays the kept one once', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    expect(track('b').calls).toEqual(['play'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,2)'])
    expect(waits.map(w => w.seconds)).toEqual([2])
    await advance(2)
    expect(track('a').calls.slice(-2)).toEqual(['pause', 'dispose'])
    await audio.unlock()
    expect(h.unlockCalls).toBe(1)
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
  })

  it('unlock() that the browser still refuses leaves blocked true', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    h.unlockResult = false
    await audio.unlock()
    expect(audio.blocked.value).toBe(true)
    expect(track('a').calls).toEqual(['play'])
  })

  it('a new scene replaces a blocked track, which is disposed unheard', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(track('a').calls).toEqual(['play', 'dispose'])
    track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('unlock() before the replacement is ready only records the gesture; the replacement then plays exactly once', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(track('a').calls).toEqual(['play', 'dispose'])
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual([])
    track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(fadeWaits()).toHaveLength(0)
  })

  it('unlock() after the replacement is ready and refused plays it exactly once, never fading it out', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    await audio.unlock()
    await audio.unlock()
    expect(track('b').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(fadeWaits()).toHaveLength(0)
  })

  it('setting the current src while another scene is loading drops the loading one and leaves the current untouched', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    audio.setScene('a.mp3'); await flush()
    expect(tracks).toHaveLength(2)
    expect(track('b').calls).toEqual(['dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('blocked clears when the kept refused track is replaced by one that then fails to load', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    audio.setScene('b.mp3'); track('b').rejectReady(); await flush()
    expect(audio.blocked.value).toBe(false)
  })

  it('blocked clears when the previous src is set again while a refused track is kept; it loads anew, since its old track faded out', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    audio.setScene('a.mp3'); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual(['play', 'dispose'])
    expect(tracks.map(t => t.src)).toEqual(['a.mp3', 'b.mp3', 'a.mp3'])
  })

  it('unlock() with nothing blocked starts nothing', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    await audio.unlock()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('stop() fades out, disposes everything and ignores a track that becomes ready afterwards', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); await flush()
    audio.stop(); await flush()
    expect(track('b').calls).toEqual(['dispose'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    await advance(2)
    expect(track('a').calls.slice(-2)).toEqual(['pause', 'dispose'])
    track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['dispose'])
  })

  it('setVolume passes through to setMasterVolume, clamped to 0..1', () => {
    audio.setVolume(0.5)
    audio.setVolume(-1)
    audio.setVolume(3)
    expect(masterVolumes).toEqual([0.5, 0, 1])
  })

  it('an interruption of the playing track sets blocked; unlock() resumes it with play() from where it stopped and restores its gain', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt()
    expect(audio.blocked.value).toBe(true)
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'play', 'fadeTo(1,2)'])
    expect(tracks).toHaveLength(1)
  })

  it('an interrupted track that the browser still refuses stays blocked', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt()
    track('a').refusePlay()
    await audio.unlock()
    expect(audio.blocked.value).toBe(true)
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'play', 'play', 'fadeTo(1,2)'])
  })

  it('an interruption of a track that is fading out is ignored', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    track('a').interrupt()
    expect(audio.blocked.value).toBe(false)
  })

  it('a new scene replaces an interrupted one and clears blocked once it plays', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt()
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
  })

  it('while a refused play waits, every document gesture unlocks; the listener stays across a failed gesture and goes once playback starts', async () => {
    expect(h.gestureInstalls).toBe(0)
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    h.unlockResult = false
    h.gestures[0]!()
    await flush()
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
    h.unlockResult = true
    h.gestures[0]!()
    await flush()
    expect(h.unlockCalls).toBe(2)
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(h.gestures).toHaveLength(0)
    expect(h.gestureInstalls).toBe(1)
  })

  it('the gesture listener is removed when blocked clears another way (the prompt\'s button, a new scene)', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    audio.setScene(null); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(h.gestures).toHaveLength(0)
  })

  it('a suspended context brings the gesture listener; an outside pause blocks without it, and only an explicit unlock() resumes', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt('paused')
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(0)
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'play', 'fadeTo(1,2)'])
    track('a').interrupt('suspended')
    expect(h.gestures).toHaveLength(1)
  })

  it('an outside pause whose resume is then refused does bring the gesture listener', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt('paused')
    track('a').refusePlay()
    await audio.unlock()
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
  })

  it('an error after start is not blocked: the track goes, it is logged once, and the same src can be asked for again', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt('error')
    expect(audio.blocked.value).toBe(false)
    expect(h.gestures).toHaveLength(0)
    expect(track('a').calls.at(-1)).toBe('dispose')
    expect(warn).toHaveBeenCalledTimes(1)
    audio.setScene('a.mp3'); await flush()
    expect(tracks).toHaveLength(2)
  })

  it('a track the browser brings back by itself clears blocked without another play', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt()
    expect(audio.blocked.value).toBe(true)
    track('a').resumeByItself()
    expect(audio.blocked.value).toBe(false)
    expect(h.gestures).toHaveLength(0)
    await audio.unlock()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
  })

  it('unlock() settles in bounded time even if the context never resumes; a later unlock still works', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    h.unlockHangs = true
    let settled = false
    void audio.unlock().then(() => { settled = true })
    await flush()
    expect(settled).toBe(false)
    expect(waits.map(w => w.seconds)).toContain(UNLOCK_WAIT_SECONDS)
    await advance(UNLOCK_WAIT_SECONDS)
    expect(settled).toBe(true)
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
    h.unlockHangs = false
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    h.answerUnlock[0]!(true)
    await flush()
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
  })

  it('a resume that arrives after the bound still plays the waiting track', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    h.unlockHangs = true
    const done = audio.unlock()
    await advance(UNLOCK_WAIT_SECONDS)
    await done
    h.answerUnlock[0]!(true)
    await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
  })

  it('the current track is pinned; one fading out or still incoming is not', async () => {
    audio.setScene('a.mp3'); await flush()
    expect(track('a').pinned).toBe(false)
    track('a').resolveReady(); await flush()
    expect(track('a').pinned).toBe(true)
    audio.setScene('b.mp3'); await flush()
    expect(track('b').pinned).toBe(false)
    track('b').resolveReady(); await flush()
    expect(track('a').pinned).toBe(false)
    expect(track('b').pinned).toBe(true)
    audio.stop()
    expect(track('b').pinned).toBe(false)
  })

  it('a scene switch completes when the old track\'s fades, pause and dispose throw', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').breakAutomation()
    expect(() => audio.setScene('b.mp3')).not.toThrow()
    track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    expect(fadeWaits().map(w => w.seconds)).toEqual([2])
    await advance(2)
    expect(track('a').calls.slice(-2)).toEqual(['pause', 'dispose'])
    audio.setScene('a.mp3'); await flush()
    expect(tracks).toHaveLength(3)
  })

  it('a new track whose fade in throws still becomes current and the old one still fades out', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').breakAutomation(); track('b').resolveReady(); await flush()
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    expect(track('b').pinned).toBe(true)
  })
})

describe('audio channels', () => {
  let h: Harness
  let mixer: AudioMixer

  const track = (src: string) => {
    const found = h.tracks.filter(t => t.src === src).at(-1)
    if (!found) throw new Error(`no track ${src}`)
    return found
  }
  const advance = async () => {
    h.waits.splice(0).forEach(w => w.resolve())
    await flush()
  }
  const req = (key: string, src = key, loop = true, fade = 2) => ({ key, src, loop, fade })

  beforeEach(() => {
    h = harness()
    mixer = createAudioMixer(h.deps)
  })

  it('blocked is kept per channel; the service is blocked while any channel is, and unlock() resumes every channel', async () => {
    const one = mixer.channel()
    const two = mixer.channel()
    one.request(req('a')); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(one.blocked.value).toBe(true)
    expect(two.blocked.value).toBe(false)
    expect(mixer.blocked.value).toBe(true)
    two.request(req('b')); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(two.blocked.value).toBe(true)
    await mixer.unlock()
    expect(one.blocked.value).toBe(false)
    expect(two.blocked.value).toBe(false)
    expect(mixer.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(track('b').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
  })

  it('one channel clearing its block leaves the service blocked while the other still is', async () => {
    const one = mixer.channel()
    const two = mixer.channel()
    one.request(req('a')); track('a').refusePlay(); track('a').resolveReady(); await flush()
    two.request(req('b')); track('b').refusePlay(); track('b').resolveReady(); await flush()
    one.request(null); await flush()
    expect(one.blocked.value).toBe(false)
    expect(mixer.blocked.value).toBe(true)
  })

  it('takes loop and fade length per request', async () => {
    const ch = mixer.channel()
    ch.request(req('a', 'a.mp3', false, 1)); track('a.mp3').resolveReady(); await flush()
    expect(track('a.mp3').loop).toBe(false)
    expect(track('a.mp3').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(h.waits).toHaveLength(0)
    ch.request(null); await flush()
    expect(track('a.mp3').calls.at(-1)).toBe('fadeTo(0,1)')
    expect(h.waits.map(w => w.seconds)).toEqual([1])
  })

  it('a new key with the same src restarts: a new track is created and crossfaded in', async () => {
    const ch = mixer.channel()
    ch.request(req('k1', 'a.mp3')); h.tracks[0]!.resolveReady(); await flush()
    ch.request(req('k1', 'a.mp3')); await flush()
    expect(h.tracks).toHaveLength(1)
    ch.request(req('k2', 'a.mp3')); h.tracks[1]!.resolveReady(); await flush()
    expect(h.tracks).toHaveLength(2)
    expect(h.tracks[1]!.calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(h.tracks[0]!.calls.at(-1)).toBe('fadeTo(0,2)')
  })

  it('hold() fades the playing track out and pauses it in place; release() plays it on and fades it back in', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.hold(1)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)'])
    await advance()
    expect(track('a').calls.at(-1)).toBe('pause')
    ch.release(1); await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'pause', 'play', 'fadeTo(1,1)'])
    expect(h.tracks).toHaveLength(1)
  })

  it('release() during the hold fade only fades back in, and the pending pause never comes', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.hold(1)
    ch.release(1); await flush()
    await advance()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'fadeTo(1,1)'])
  })

  it('a request while held is prepared but stays silent, the held track goes, and release() brings the new one in', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.hold(1); await advance()
    ch.request(req('b')); track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual([])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
    await advance()
    expect(track('a').calls.at(-1)).toBe('dispose')
    ch.release(1); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,1)'])
  })

  it('a null request while held leaves nothing to resume', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.hold(1); await advance()
    ch.request(null); await flush()
    await advance()
    ch.release(1); await flush()
    expect(track('a').calls.filter(c => c === 'play')).toHaveLength(1)
  })

  it('a held channel is not blocked, even with a refused track waiting; release() tries that track again', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(ch.blocked.value).toBe(true)
    ch.hold(1)
    expect(ch.blocked.value).toBe(false)
    ch.release(1); await flush()
    expect(ch.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,1)'])
  })

  // Changed on purpose (Sounds plan, Task 4 fix round 1): the same key after a natural end no longer plays it again.
  it('a non-looping track that finishes by itself is released and reported with its key; the same key stays a no-op until null or another key', async () => {
    const ch = mixer.channel()
    const ended: string[] = []
    ch.onEnded(key => ended.push(key))
    ch.request(req('k', 'a.mp3', false, 1)); track('a.mp3').resolveReady(); await flush()
    track('a.mp3').finish(); await flush()
    expect(ended).toEqual(['k'])
    expect(track('a.mp3').calls.at(-1)).toBe('dispose')
    ch.request(req('k', 'a.mp3', false, 1)); await flush()
    expect(h.tracks).toHaveLength(1)
    ch.request(null)
    ch.request(req('k', 'a.mp3', false, 1)); await flush()
    expect(h.tracks).toHaveLength(2)
  })

  it('a track that was replaced or stopped is not reported as ended', async () => {
    const ch = mixer.channel()
    const ended: string[] = []
    ch.onEnded(key => ended.push(key))
    ch.request(req('a', 'a.mp3', false)); track('a.mp3').resolveReady(); await flush()
    ch.request(req('b', 'b.mp3', false)); track('b.mp3').resolveReady(); await flush()
    track('a.mp3').finish()
    ch.stop()
    track('b.mp3').finish(); await flush()
    expect(ended).toEqual([])
  })

  it('a hold() while the incoming track\'s play() is still in flight keeps it silent once it plays', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').hangPlay(); track('a').resolveReady(); await flush()
    ch.hold(1)
    track('a').settlePlay(); await flush()
    expect(track('a').calls).toEqual(['play', 'pause'])
    expect(track('a').pinned).toBe(true)
    ch.release(1); await flush()
    expect(track('a').calls).toEqual(['play', 'pause', 'play', 'fadeTo(1,1)'])
  })

  it('a request made before hold() that becomes ready during it waits, then comes in on release()', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.request(req('b'))
    ch.hold(1); await advance()
    track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual([])
    ch.release(1); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,1)')
  })

  it('a release during a hold fade completes when the held track\'s automation throws', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    track('a').breakAutomation()
    expect(() => ch.hold(1)).not.toThrow()
    expect(() => ch.release(1)).not.toThrow()
    await advance()
    expect(ch.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'fadeTo(1,1)'])
  })

  it('a tap that unlocks one channel leaves the other channel\'s deliberate outside pause alone; an explicit unlock() resumes it', async () => {
    const one = mixer.channel()
    const two = mixer.channel()
    two.request(req('b')); track('b').resolveReady(); await flush()
    track('b').interrupt('paused')
    one.request(req('a')); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    h.gestures[0]!(); await flush()
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(two.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(0)
    await mixer.unlock()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)', 'play', 'fadeTo(1,2)'])
    expect(mixer.blocked.value).toBe(false)
  })

  it('a ready track is pinned before its play is attempted; a refused one stays pinned while it waits, and goes unpinned when dropped', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); await flush()
    expect(track('a').pinned).toBe(false)
    track('a').hangPlay(); track('a').resolveReady(); await flush()
    expect(track('a').calls).toEqual(['play'])
    expect(track('a').pinned).toBe(true)
    track('a').settlePlay(); await flush()
    ch.request(req('b')); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(ch.blocked.value).toBe(true)
    expect(track('b').pinned).toBe(true)
    ch.request(req('c')); await flush()
    expect(track('b').calls).toEqual(['play', 'dispose'])
    expect(track('b').pinned).toBe(false)
  })

  it('a track prepared while held is pinned', async () => {
    const ch = mixer.channel()
    ch.request(req('a')); track('a').resolveReady(); await flush()
    ch.hold(1); await advance()
    ch.request(req('b')); track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual([])
    expect(track('b').pinned).toBe(true)
  })

  it('onStarted reports the key once its track plays, not while it loads, fails or is refused; a held channel reports on release()', async () => {
    const ch = mixer.channel()
    const started: string[] = []
    ch.onStarted(key => started.push(key))
    ch.request(req('a')); await flush()
    expect(started).toEqual([])
    track('a').rejectReady(); await flush()
    ch.request(req('b')); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(started).toEqual([])
    await mixer.unlock()
    expect(started).toEqual(['b'])
    ch.hold(1)
    ch.request(req('c')); track('c').resolveReady(); await flush()
    expect(started).toEqual(['b'])
    ch.release(1); await flush()
    expect(started).toEqual(['b', 'c'])
  })

  it('onIdle fires each time the channel is left with no current and no incoming track', async () => {
    const ch = mixer.channel()
    let idle = 0
    ch.onIdle(() => { idle++ })
    ch.request(req('a')); track('a').rejectReady(); await flush()
    expect(idle).toBe(1)
    ch.request(req('b', 'b', false)); track('b').resolveReady(); await flush()
    ch.request(req('c')); await flush()
    track('c').rejectReady(); await flush()
    expect(idle).toBe(1)
    track('b').finish(); await flush()
    expect(idle).toBe(2)
    ch.request(req('d')); track('d').resolveReady(); await flush()
    ch.request(null); await flush()
    expect(idle).toBe(3)
    ch.stop()
    expect(idle).toBe(3)
  })
})

describe('the overlay', () => {
  let h: Harness
  let audio: SceneAudio
  let ended: string[]

  const track = (name: string) => {
    const found = h.tracks.filter(t => t.src === `${name}.mp3`).at(-1)
    if (!found) throw new Error(`no track ${name}`)
    return found
  }
  const advance = async () => {
    h.waits.splice(0).forEach(w => w.resolve())
    await flush()
  }
  const ov = (key: string, name = key, loop = false) => ({ key, src: `${name}.mp3`, loop })
  const playScene = async (name: string) => {
    audio.setScene(`${name}.mp3`); track(name).resolveReady(); await flush()
  }
  const playOverlay = async (key: string, name = key) => {
    audio.setOverlay(ov(key, name)); track(name).resolveReady(); await flush()
  }
  const plays = (name: string) => track(name).calls.filter(c => c === 'play').length
  // Audible: its last fade went to 1, and nothing paused or released it since.
  const audible = () => h.tracks
    .filter(t => t.calls.filter(c => c.startsWith('fadeTo') || c === 'pause' || c === 'dispose').at(-1)?.startsWith('fadeTo(1,'))
    .map(t => t.src)

  beforeEach(() => {
    warn.mockClear()
    h = harness()
    audio = createSceneAudio(h.deps)
    ended = []
    audio.onOverlayEnded(key => ended.push(key))
  })

  it('exposes a 1 second overlay fade constant', () => {
    expect(OVERLAY_FADE_SECONDS).toBe(1)
  })

  it('when the overlay is ready: the scene fades to 0 over 1 s and pauses, the overlay plays and fades in over 1 s', async () => {
    await playScene('a')
    audio.setOverlay(ov('k', 'o')); await flush()
    expect(track('o').loop).toBe(false)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    track('o').resolveReady(); await flush()
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)'])
    expect(h.waits.map(w => w.seconds)).toEqual([1])
    await advance()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'pause'])
    expect(audible()).toEqual(['o.mp3'])
  })

  it('an overlay still loading leaves the scene playing untouched', async () => {
    await playScene('a')
    audio.setOverlay(ov('k', 'o')); await flush()
    expect(track('o').calls).toEqual([])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(h.waits).toHaveLength(0)
  })

  it('an overlay that fails to load leaves the scene playing untouched', async () => {
    await playScene('a')
    audio.setOverlay(ov('k', 'o')); track('o').rejectReady(); await flush()
    expect(track('o').calls).toEqual(['dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(h.waits).toHaveLength(0)
    expect(audio.blocked.value).toBe(false)
  })

  it('an overlay whose play fails, or that the browser refuses, leaves the scene playing untouched; a refused one blocks', async () => {
    await playScene('a')
    audio.setOverlay(ov('k1', 'o')); track('o').failPlay(); track('o').resolveReady(); await flush()
    expect(track('o').calls).toEqual(['play', 'dispose'])
    audio.setOverlay(ov('k2', 'p')); track('p').refusePlay(); track('p').resolveReady(); await flush()
    expect(track('p').calls).toEqual(['play'])
    expect(audio.blocked.value).toBe(true)
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(h.waits).toHaveLength(0)
  })

  it('setOverlay(null): the overlay fades out over 1 s and is disposed, the scene track plays from where it paused and fades to 1', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    audio.setOverlay(null); await flush()
    expect(track('o').calls.at(-1)).toBe('fadeTo(0,1)')
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'pause', 'play', 'fadeTo(1,1)'])
    expect(h.tracks).toHaveLength(2)
    await advance()
    expect(track('o').calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(ended).toEqual([])
    expect(audible()).toEqual(['a.mp3'])
  })

  it('a non-looping overlay that finishes: disposed, scene resumes, onOverlayEnded fires with its key', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    const sceneAtEnd: string[][] = []
    audio.onOverlayEnded(() => sceneAtEnd.push([...track('a').calls]))
    track('o').finish(); await flush()
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)', 'dispose'])
    expect(track('a').calls.slice(-2)).toEqual(['play', 'fadeTo(1,1)'])
    expect(ended).toEqual(['k'])
    // The scene is on its way back before the listener hears of the end.
    expect(sceneAtEnd[0]!.filter(c => c === 'play')).toHaveLength(2)
    track('o').finish(); await flush()
    expect(ended).toEqual(['k'])
    expect(audible()).toEqual(['a.mp3'])
  })

  it('the same key sent again after the overlay ended by itself plays nothing and does not hold the scene again', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    track('o').finish(); await flush()
    const sceneCalls = [...track('a').calls]
    audio.setOverlay(ov('k', 'o')); await flush()
    expect(h.tracks).toHaveLength(2)
    expect(track('a').calls).toEqual(sceneCalls)
    expect(ended).toEqual(['k'])
  })

  it('after an overlay ended by itself, null then the same key plays it again, and so does a different key', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    track('o').finish(); await flush()
    audio.setOverlay(null)
    audio.setOverlay(ov('k', 'o')); await flush()
    expect(h.tracks).toHaveLength(3)
    h.tracks[2]!.resolveReady(); await flush()
    expect(h.tracks[2]!.calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,1)')
    h.tracks[2]!.finish(); await flush()
    await playOverlay('k2', 'p')
    expect(track('p').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(ended).toEqual(['k', 'k'])
  })

  it('the same listener subscribed twice is called twice, and each unsubscribe removes one', async () => {
    const heard: string[] = []
    const listener = (key: string) => heard.push(key)
    const offFirst = audio.onOverlayEnded(listener)
    audio.onOverlayEnded(listener)
    await playOverlay('k1', 'o')
    track('o').finish(); await flush()
    expect(heard).toEqual(['k1', 'k1'])
    offFirst()
    offFirst()
    await playOverlay('k2', 'p')
    track('p').finish(); await flush()
    expect(heard).toEqual(['k1', 'k1', 'k2'])
  })

  it('onOverlayEnded returns an unsubscribe', async () => {
    const heard: string[] = []
    const off = audio.onOverlayEnded(key => heard.push(key))
    off()
    await playOverlay('k', 'o')
    track('o').finish(); await flush()
    expect(heard).toEqual([])
    expect(ended).toEqual(['k'])
  })

  it('a stopped or replaced overlay does not fire onOverlayEnded', async () => {
    await playOverlay('k1', 'o')
    await playOverlay('k2', 'p')
    track('o').finish()
    audio.setOverlay(null); await flush()
    track('p').finish(); await flush()
    await playOverlay('k3', 'q')
    audio.stop()
    track('q').finish(); await flush()
    expect(ended).toEqual([])
  })

  it('a new key with the same src restarts: the old track is disposed, a new one created; the scene stays held', async () => {
    await playScene('a'); await playOverlay('k1', 'o'); await advance()
    const [, first] = h.tracks
    audio.setOverlay(ov('k2', 'o')); await flush()
    expect(h.tracks).toHaveLength(3)
    const second = h.tracks[2]!
    expect(second.src).toBe('o.mp3')
    second.resolveReady(); await flush()
    expect(second.calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(first!.calls.at(-1)).toBe('fadeTo(0,1)')
    await advance()
    expect(first!.calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'pause'])
    expect(ended).toEqual([])
  })

  it('a replacement during the scene\'s hold fade keeps the scene held: it never comes back between the two', async () => {
    await playScene('a'); await playOverlay('k1', 'o')
    await playOverlay('k2', 'p')
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)'])
    expect(track('o').calls.at(-1)).toBe('fadeTo(0,1)')
    await advance()
    expect(track('a').calls.at(-1)).toBe('pause')
    expect(audible()).toEqual(['p.mp3'])
  })

  it('a replacement that fails to load leaves the playing overlay and the held scene as they are', async () => {
    await playScene('a'); await playOverlay('k1', 'o'); await advance()
    audio.setOverlay(ov('k2', 'p')); track('p').rejectReady(); await flush()
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(track('a').calls.at(-1)).toBe('pause')
  })

  it('the same key again does nothing', async () => {
    await playOverlay('k', 'o')
    audio.setOverlay(ov('k', 'o')); await flush()
    expect(h.tracks).toHaveLength(1)
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)'])
  })

  it('setScene during an overlay: the old scene track is disposed, the new one is prepared but neither played nor faded in; it comes in when the overlay ends', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual([])
    await advance()
    expect(track('a').calls.at(-1)).toBe('dispose')
    track('o').finish(); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(plays('a')).toBe(1)
    expect(audible()).toEqual(['b.mp3'])
  })

  it('setScene during an overlay: the new scene comes in when the overlay is stopped too', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    audio.setOverlay(null); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(plays('a')).toBe(1)
  })

  it('setScene(null) during an overlay: nothing resumes when the overlay ends', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    audio.setScene(null); await flush(); await advance()
    audio.setOverlay(null); await flush(); await advance()
    expect(plays('a')).toBe(1)
    expect(h.tracks).toHaveLength(2)
    expect(audible()).toEqual([])
  })

  it('stop during the overlay fade-in and start during its fade-out end with one audible track', async () => {
    await playScene('a'); await playOverlay('k1', 'o')
    audio.setOverlay(null); await flush()
    await advance()
    expect(track('o').calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'fadeTo(1,1)'])
    expect(audible()).toEqual(['a.mp3'])

    await playOverlay('k2', 'p')
    audio.setOverlay(null); await flush()
    await playOverlay('k3', 'q')
    await advance()
    expect(track('p').calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(track('a').calls.at(-1)).toBe('pause')
    expect(audible()).toEqual(['q.mp3'])
  })

  it('with no scene sound an overlay just plays and ends in silence', async () => {
    await playOverlay('k', 'o')
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)'])
    track('o').finish(); await flush()
    expect(ended).toEqual(['k'])
    expect(h.tracks).toHaveLength(1)
    expect(audible()).toEqual([])
  })

  it('a scene asked for during an overlay with no scene sound comes in when the overlay ends', async () => {
    await playOverlay('k', 'o')
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    expect(track('a').calls).toEqual([])
    track('o').finish(); await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,1)'])
  })

  it('unlock() after a refused overlay play starts the overlay, not the scene', async () => {
    await playScene('a')
    audio.setOverlay(ov('k', 'o')); track('o').refusePlay(); track('o').resolveReady(); await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('o').calls).toEqual(['play', 'play', 'fadeTo(1,1)'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)'])
  })

  it('a tap after a refused overlay play starts the overlay and holds the scene', async () => {
    await playScene('a')
    audio.setOverlay(ov('k', 'o')); track('o').refusePlay(); track('o').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    h.gestures[0]!(); await flush()
    expect(track('o').calls).toEqual(['play', 'play', 'fadeTo(1,1)'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)'])
  })

  it('unlock() with both refused tries the overlay first, so the scene\'s start finds it held and never fades in', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setOverlay(ov('k', 'o')); track('o').refusePlay(); track('o').resolveReady(); await flush()
    const order: string[] = []
    const scenePlay = track('a').play.bind(track('a'))
    const overlayPlay = track('o').play.bind(track('o'))
    track('a').play = () => { order.push('scene'); return scenePlay() }
    track('o').play = () => { order.push('overlay'); return overlayPlay() }
    await audio.unlock()
    expect(order).toEqual(['overlay', 'scene'])
    expect(track('a').calls).toEqual(['play', 'play', 'pause'])
  })

  it('unlock() with both the scene and the overlay refused ends with the overlay audible and the scene held', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setOverlay(ov('k', 'o')); track('o').refusePlay(); track('o').resolveReady(); await flush()
    await audio.unlock()
    await advance()
    expect(track('o').calls).toEqual(['play', 'play', 'fadeTo(1,1)'])
    expect(track('a').calls.at(-1)).toBe('pause')
    expect(audible()).toEqual(['o.mp3'])
    track('o').finish(); await flush()
    expect(audible()).toEqual(['a.mp3'])
  })

  it('setOverlay(null) while a refused replacement waits releases the scene', async () => {
    await playScene('a'); await playOverlay('k1', 'o'); await advance()
    audio.setOverlay(ov('k2', 'p')); track('p').refusePlay(); track('p').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    expect(track('a').calls.at(-1)).toBe('pause')
    audio.setOverlay(null); await flush()
    expect(track('p').calls).toEqual(['play', 'dispose'])
    expect(track('a').calls.slice(-2)).toEqual(['play', 'fadeTo(1,1)'])
    expect(audio.blocked.value).toBe(false)
  })

  it('an overlay error while its replacement loads keeps the scene held; the replacement then failing to load releases it', async () => {
    await playScene('a'); await playOverlay('k1', 'o'); await advance()
    audio.setOverlay(ov('k2', 'p')); await flush()
    track('o').interrupt('error'); await flush()
    expect(track('a').calls.at(-1)).toBe('pause')
    track('p').rejectReady(); await flush()
    expect(track('a').calls.slice(-2)).toEqual(['play', 'fadeTo(1,1)'])
    expect(ended).toEqual([])
  })

  it('an overlay that errors mid-play is dropped and the scene comes back, without onOverlayEnded', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    track('o').interrupt('error'); await flush()
    expect(track('o').calls.at(-1)).toBe('dispose')
    expect(track('a').calls.slice(-2)).toEqual(['play', 'fadeTo(1,1)'])
    expect(ended).toEqual([])
    expect(audio.blocked.value).toBe(false)
  })

  it('an outside pause of the overlay blocks it without the tap listener and keeps the scene held; an explicit unlock() resumes the overlay', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    track('o').interrupt('paused')
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(0)
    await audio.unlock()
    expect(audio.blocked.value).toBe(false)
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)', 'play', 'fadeTo(1,1)'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)', 'fadeTo(0,1)', 'pause'])
  })

  it('a suspended context blocks the overlay with the tap listener and keeps the scene held; a tap resumes the overlay', async () => {
    await playScene('a'); await playOverlay('k', 'o'); await advance()
    track('o').interrupt('suspended')
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
    h.gestures[0]!(); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)', 'play', 'fadeTo(1,1)'])
    expect(plays('a')).toBe(1)
  })

  it('stop() disposes the overlay too, and leaves neither channel held', async () => {
    await playScene('a'); await playOverlay('k', 'o')
    audio.stop(); await flush()
    expect(track('o').calls.at(-1)).toBe('fadeTo(0,1)')
    await advance()
    expect(track('o').calls.slice(-2)).toEqual(['pause', 'dispose'])
    expect(track('a').calls.at(-1)).toBe('dispose')
    expect(plays('a')).toBe(1)
    expect(ended).toEqual([])
    audio.setScene('b.mp3'); track('b').resolveReady(); await flush()
    expect(track('b').calls).toEqual(['play', 'fadeTo(1,2)'])
    await playOverlay('k', 'p')
    expect(track('b').calls.at(-1)).toBe('fadeTo(0,1)')
  })
})

describe('arming', () => {
  let h: Harness
  let audio: SceneAudio

  const track = (name: string) => {
    const found = h.tracks.filter(t => t.src === `${name}.mp3`).at(-1)
    if (!found) throw new Error(`no track ${name}`)
    return found
  }

  beforeEach(() => {
    h = harness()
    h.needsPriming = true
    audio = createSceneAudio(h.deps)
  })

  it('not armed: no gesture listener, and an overlay on an unprimed pool is refused', async () => {
    expect(h.gestureInstalls).toBe(0)
    audio.setOverlay({ key: 'k', src: 'o.mp3', loop: false }); track('o').resolveReady(); await flush()
    expect(track('o').calls).toEqual(['play'])
    expect(audio.blocked.value).toBe(true)
  })

  it('armed, the first gesture primes the pool once and the listener goes', async () => {
    audio.arm()
    expect(h.gestures).toHaveLength(1)
    h.gestures[0]!()
    await flush()
    expect(h.unlockCalls).toBe(1)
    expect(h.gestures).toHaveLength(0)
    expect(h.gestureInstalls).toBe(1)
  })

  it('arming twice installs one listener', () => {
    audio.arm()
    audio.arm()
    expect(h.gestureInstalls).toBe(1)
    expect(h.gestures).toHaveLength(1)
  })

  it('a gesture that primes nothing keeps the listener for the next one', async () => {
    audio.arm()
    h.primeWorks = false
    h.gestures[0]!()
    await flush()
    expect(h.gestures).toHaveLength(1)
    h.primeWorks = true
    h.gestures[0]!()
    await flush()
    expect(h.unlockCalls).toBe(2)
    expect(h.gestures).toHaveLength(0)
  })

  it('a refused resume keeps the listener even when the elements were primed', async () => {
    audio.arm()
    h.unlockResult = false
    h.gestures[0]!()
    await flush()
    expect(h.gestures).toHaveLength(1)
  })

  it('arming after the pool was primed (the prompt\'s button) installs nothing', async () => {
    await audio.unlock()
    audio.arm()
    expect(h.gestureInstalls).toBe(0)
  })

  it('arm, a gesture, then an overlay plays without a refusal', async () => {
    audio.arm()
    h.gestures[0]!()
    await flush()
    audio.setOverlay({ key: 'k', src: 'o.mp3', loop: false }); track('o').resolveReady(); await flush()
    expect(track('o').calls).toEqual(['play', 'fadeTo(1,1)'])
    expect(audio.blocked.value).toBe(false)
    expect(h.gestures).toHaveLength(0)
  })

  it('a gesture while armed never resumes a deliberate outside pause', async () => {
    h.needsPriming = false
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    track('a').interrupt('paused')
    audio.arm()
    h.gestures[0]!()
    await flush()
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(audio.blocked.value).toBe(true)
  })

  it('the listener outlives the scope that first used the mixer', async () => {
    const { effectScope } = await import('vue')
    const scope = effectScope()
    let late!: SceneAudio
    scope.run(() => { late = createSceneAudio(h.deps) })
    scope.stop()
    h.needsPriming = false
    late.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(late.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
  })
})
