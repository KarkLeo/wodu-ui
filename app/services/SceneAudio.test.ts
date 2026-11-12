import { describe, it, expect, beforeEach } from 'vitest'
import {
  createAudioMixer,
  createSceneAudio,
  IDLE_DELAY_SECONDS,
  SCENE_FADE_SECONDS,
  type AudioMixer,
  type SceneAudio,
  type SceneAudioDeps,
  type Track,
} from './SceneAudio'

interface FakeTrack extends Track {
  src: string
  loop: boolean
  calls: string[]
  resolveReady(): void
  rejectReady(): void
  refusePlay(): void
  failPlay(): void
  /** The browser stopped it: an error after start, a pause from outside, the context leaving `running`. */
  interrupt(): void
  /** A non-looping track reached its end. */
  finish(): void
}

function makeFakeTrack(src: string, loop: boolean): FakeTrack {
  let resolveReady!: () => void
  let rejectReady!: (e: Error) => void
  const ready = new Promise<void>((res, rej) => {
    resolveReady = res
    rejectReady = rej
  })
  ready.catch(() => {})
  const calls: string[] = []
  const interrupted: Array<() => void> = []
  const ended: Array<() => void> = []
  let playMode: 'ok' | 'refuse' | 'fail' = 'ok'
  return {
    src,
    loop,
    calls,
    ready,
    resolveReady: () => resolveReady(),
    rejectReady: () => rejectReady(new Error('load failed')),
    refusePlay: () => { playMode = 'refuse' },
    failPlay: () => { playMode = 'fail' },
    interrupt: () => interrupted.forEach(l => l()),
    finish: () => ended.forEach(l => l()),
    play() {
      calls.push('play')
      const mode = playMode
      playMode = 'ok'
      if (mode === 'refuse') return Promise.reject(new DOMException('gesture needed', 'NotAllowedError'))
      if (mode === 'fail') return Promise.reject(new DOMException('bad media', 'NotSupportedError'))
      return Promise.resolve()
    },
    pause() { calls.push('pause') },
    fadeTo(level, seconds) { calls.push(`fadeTo(${level},${seconds})`) },
    onEnded(listener) { ended.push(listener) },
    onInterrupted(listener) { interrupted.push(listener) },
    dispose() { calls.push('dispose') },
  }
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

interface Harness {
  tracks: FakeTrack[]
  waits: Array<{ seconds: number, resolve: () => void }>
  masterVolumes: number[]
  unlockResult: boolean
  unlockCalls: number
  idleCalls: number
  /** The document-gesture listeners installed and not yet removed. */
  gestures: Array<() => void>
  gestureInstalls: number
  deps: SceneAudioDeps
}

function harness(): Harness {
  const h: Harness = {
    tracks: [],
    waits: [],
    masterVolumes: [],
    unlockResult: true,
    unlockCalls: 0,
    idleCalls: 0,
    gestures: [],
    gestureInstalls: 0,
    deps: undefined as unknown as SceneAudioDeps,
  }
  h.deps = {
    createTrack(src, loop) {
      const t = makeFakeTrack(src, loop)
      h.tracks.push(t)
      return t
    },
    wait: seconds => new Promise<void>(resolve => { h.waits.push({ seconds, resolve }) }),
    setMasterVolume: level => { h.masterVolumes.push(level) },
    unlock: async () => { h.unlockCalls++; return h.unlockResult },
    idle: () => { h.idleCalls++ },
    // Like the shell's: fires once, then is gone.
    addGestureListener(callback) {
      h.gestureInstalls++
      const remove = () => {
        const i = h.gestures.indexOf(fire)
        if (i >= 0) h.gestures.splice(i, 1)
      }
      const fire = () => { remove(); callback() }
      h.gestures.push(fire)
      return remove
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

  beforeEach(() => {
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
    expect(waits).toHaveLength(0)
  })

  it('unlock() after the replacement is ready and refused plays it exactly once, never fading it out', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    await audio.unlock()
    await audio.unlock()
    expect(track('b').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(waits).toHaveLength(0)
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

  it('while blocked, one document gesture is listened for and unlocks; the listener goes when nothing is blocked', async () => {
    expect(h.gestureInstalls).toBe(0)
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    h.gestures[0]!()
    await flush()
    expect(h.unlockCalls).toBe(1)
    expect(audio.blocked.value).toBe(false)
    expect(track('a').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(h.gestures).toHaveLength(0)
    expect(h.gestureInstalls).toBe(1)
  })

  it('a gesture whose unlock the browser refuses listens again for the next one', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    h.unlockResult = false
    h.gestures[0]!()
    await flush()
    expect(audio.blocked.value).toBe(true)
    expect(h.gestures).toHaveLength(1)
    expect(h.gestureInstalls).toBe(2)
  })

  it('the gesture listener is removed when blocked clears another way (the prompt\'s button, a new scene)', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    expect(h.gestures).toHaveLength(1)
    audio.setScene(null); await flush()
    expect(audio.blocked.value).toBe(false)
    expect(h.gestures).toHaveLength(0)
  })

  it('after the last track has faded out and been released, idle() follows a short delay', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene(null); await flush()
    await advance(SCENE_FADE_SECONDS)
    expect(h.idleCalls).toBe(0)
    expect(waits.map(w => w.seconds)).toEqual([IDLE_DELAY_SECONDS])
    await advance(IDLE_DELAY_SECONDS)
    expect(h.idleCalls).toBe(1)
  })

  it('a new request during the idle delay cancels idle()', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.stop(); await flush()
    await advance(SCENE_FADE_SECONDS)
    audio.setScene('b.mp3'); await flush()
    await advance(IDLE_DELAY_SECONDS)
    expect(h.idleCalls).toBe(0)
  })

  it('replacing a track that is still loading does not count as silence', async () => {
    audio.setScene('a.mp3'); await flush()
    audio.setScene('b.mp3'); await flush()
    expect(waits).toHaveLength(0)
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

  it('a non-looping track that finishes by itself is released and reported with its key', async () => {
    const ch = mixer.channel()
    const ended: string[] = []
    ch.onEnded(key => ended.push(key))
    ch.request(req('k', 'a.mp3', false, 1)); track('a.mp3').resolveReady(); await flush()
    track('a.mp3').finish(); await flush()
    expect(ended).toEqual(['k'])
    expect(track('a.mp3').calls.at(-1)).toBe('dispose')
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

  it('idle() waits for every channel to fall silent', async () => {
    const one = mixer.channel()
    const two = mixer.channel()
    one.request(req('a')); track('a').resolveReady(); await flush()
    two.request(req('b')); track('b').resolveReady(); await flush()
    one.request(null); await flush()
    await advance()
    await advance()
    expect(h.idleCalls).toBe(0)
    mixer.stop(); await flush()
    await advance()
    await advance()
    expect(h.idleCalls).toBe(1)
  })
})
