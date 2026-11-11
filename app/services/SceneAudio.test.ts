import { describe, it, expect, beforeEach } from 'vitest'
import { createSceneAudio, SCENE_FADE_SECONDS, type SceneAudio, type SceneAudioDeps, type Track } from './SceneAudio'

interface FakeTrack extends Track {
  src: string
  loop: boolean
  calls: string[]
  resolveReady(): void
  rejectReady(): void
  refusePlay(): void
  failPlay(): void
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
    dispose() { calls.push('dispose') },
  }
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

describe('SceneAudio', () => {
  let tracks: FakeTrack[]
  let waits: Array<{ seconds: number, resolve: () => void }>
  let masterVolumes: number[]
  let unlockResult: boolean
  let unlockCalls: number
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
    tracks = []
    waits = []
    masterVolumes = []
    unlockResult = true
    unlockCalls = 0
    const deps: SceneAudioDeps = {
      createTrack(src, loop) {
        const t = makeFakeTrack(src, loop)
        tracks.push(t)
        return t
      },
      wait: seconds => new Promise<void>(resolve => { waits.push({ seconds, resolve }) }),
      setMasterVolume: level => { masterVolumes.push(level) },
      unlock: async () => { unlockCalls++; return unlockResult },
    }
    audio = createSceneAudio(deps)
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

  it('a refused play sets blocked and keeps the track; unlock() clears blocked and plays it once', async () => {
    audio.setScene('a.mp3'); track('a').resolveReady(); await flush()
    audio.setScene('b.mp3'); track('b').refusePlay(); track('b').resolveReady(); await flush()
    expect(audio.blocked.value).toBe(true)
    expect(track('b').calls).toEqual(['play'])
    expect(track('a').calls).toEqual(['play', 'fadeTo(1,2)'])
    expect(waits).toHaveLength(0)
    await audio.unlock()
    expect(unlockCalls).toBe(1)
    expect(audio.blocked.value).toBe(false)
    expect(track('b').calls).toEqual(['play', 'play', 'fadeTo(1,2)'])
    expect(track('a').calls.at(-1)).toBe('fadeTo(0,2)')
  })

  it('unlock() that the browser still refuses leaves blocked true', async () => {
    audio.setScene('a.mp3'); track('a').refusePlay(); track('a').resolveReady(); await flush()
    unlockResult = false
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
})
