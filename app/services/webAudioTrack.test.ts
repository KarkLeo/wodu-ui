import { describe, it, expect, beforeEach } from 'vitest'
import type { SceneAudioDeps, Track } from './SceneAudio'
import {
  equalPowerCurve,
  POOL_SIZE,
  READY_FALLBACK_SECONDS,
  RESUME_GRACE_MS,
  SILENT_SRC,
  webAudioDeps,
  type WebAudioEnv,
} from './webAudioTrack'

type Listener = (event: Event) => void

class FakeTarget {
  listeners = new Map<string, Set<Listener>>()
  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn)
  }
  dispatch(type: string, extra: Record<string, unknown> = {}) {
    const event = { type, ...extra } as unknown as Event
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event)
  }
  listenerCount() {
    let n = 0
    for (const set of this.listeners.values()) n += set.size
    return n
  }
}

class FakeAudio extends FakeTarget {
  static made: FakeAudio[] = []
  src = ''
  loop = false
  paused = true
  ended = false
  crossOrigin: string | null = null
  preload = ''
  plays: string[] = []
  pauses = 0
  constructor() {
    super()
    FakeAudio.made.push(this)
  }
  play() {
    this.plays.push(this.src)
    this.paused = false
    return Promise.resolve()
  }
  // Real browsers queue the event; firing it at once is the harder case for the "not ours" check.
  pause() {
    this.pauses++
    const was = this.paused
    this.paused = true
    if (!was) this.dispatch('pause')
  }
  load() {}
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
  /** The browser pauses it: a call, another app, the lock screen. */
  pauseFromOutside() {
    this.paused = true
    this.dispatch('pause')
  }
  reachEnd() {
    this.ended = true
    this.paused = true
    this.dispatch('pause')
    this.dispatch('ended')
  }
}

class FakeParam {
  value = 0
  calls: string[] = []
  curves: number[][] = []
  throwOnCurve = false
  cancelScheduledValues(t: number) { this.calls.push(`cancel(${t})`) }
  setValueAtTime(v: number, t: number) { this.calls.push(`set(${v},${t})`); this.value = v }
  linearRampToValueAtTime(v: number, t: number) { this.calls.push(`ramp(${v},${t})`) }
  setValueCurveAtTime(curve: Float32Array, t: number, d: number) {
    if (this.throwOnCurve) throw new DOMException('overlaps', 'NotSupportedError')
    this.calls.push(`curve(${t},${d})`)
    this.curves.push([...curve])
  }
}

class FakeGain {
  gain = new FakeParam()
  connect() {}
  disconnect() { throw new Error('nodes are never disconnected') }
}

class FakeContext extends FakeTarget {
  static made: FakeContext[] = []
  /** How the next context's `resume()` answers: at once, or only on `finishResume()`. */
  static resumeMode: 'run' | 'pending' = 'run'
  state: AudioContextState = 'suspended'
  currentTime = 10
  destination = {}
  gains: FakeGain[] = []
  sources = 0
  resumeMode = FakeContext.resumeMode
  resumes = 0
  suspends = 0
  private pendingResume: (() => void) | null = null
  constructor() {
    super()
    FakeContext.made.push(this)
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createMediaElementSource() {
    this.sources++
    return { connect() {} }
  }
  resume() {
    this.resumes++
    if (this.resumeMode === 'run') {
      this.setState('running')
      return Promise.resolve()
    }
    return new Promise<void>(resolve => { this.pendingResume = resolve })
  }
  finishResume() {
    this.setState('running')
    this.pendingResume?.()
  }
  suspend() {
    this.suspends++
    this.setState('suspended')
    return Promise.resolve()
  }
  setState(state: AudioContextState) {
    this.state = state
    this.dispatch('statechange')
  }
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

describe('webAudioDeps', () => {
  let timers: Map<number, { ms: number, fn: () => void }>
  let nextTimer: number
  let doc: FakeTarget
  let deps: SceneAudioDeps

  const ctx = () => FakeContext.made[0]!
  const runTimers = (ms?: number) => {
    for (const [id, t] of [...timers]) {
      if (ms !== undefined && t.ms !== ms) continue
      timers.delete(id)
      t.fn()
    }
  }
  const elementOf = (n: number) => FakeAudio.made[n]!
  // Each pooled element's gain is the one made right after it; the first gain is the master.
  const gainOf = (n: number) => ctx().gains[n + 1]!.gain

  async function playing(src = 'a.mp3', loop = true): Promise<Track> {
    const t = deps.createTrack(src, loop)
    await t.play()
    return t
  }

  beforeEach(() => {
    FakeAudio.made = []
    FakeContext.made = []
    FakeContext.resumeMode = 'run'
    timers = new Map()
    nextTimer = 1
    doc = new FakeTarget()
    const env: WebAudioEnv = {
      Audio: FakeAudio as unknown as WebAudioEnv['Audio'],
      AudioContext: FakeContext as unknown as WebAudioEnv['AudioContext'],
      setTimeout: (fn, ms) => {
        const id = nextTimer++
        timers.set(id, { ms, fn })
        return id
      },
      clearTimeout: id => { timers.delete(id as number) },
      document: doc as unknown as WebAudioEnv['document'],
    }
    deps = webAudioDeps(env)
  })

  describe('the element pool', () => {
    it(`never constructs more than ${POOL_SIZE} elements across 20 create / dispose cycles, nor recreates their nodes`, () => {
      const alive: Track[] = []
      for (let i = 0; i < 20; i++) {
        alive.push(deps.createTrack(`s${i}.mp3`, true))
        if (alive.length > 3) alive.shift()!.dispose()
      }
      for (let i = 0; i < 6; i++) alive.push(deps.createTrack(`burst${i}.mp3`, true))
      expect(FakeAudio.made.length).toBeLessThanOrEqual(POOL_SIZE)
      expect(ctx().sources).toBe(FakeAudio.made.length)
      expect(ctx().gains).toHaveLength(FakeAudio.made.length + 1)
    })

    it('reuses a returned element by changing its src, and returns it paused, without src and at gain 0', async () => {
      const a = await playing('a.mp3')
      a.fadeTo(1, 0)
      a.dispose()
      expect(elementOf(0).paused).toBe(true)
      expect(elementOf(0).src).toBe('')
      expect(gainOf(0).value).toBe(0)
      deps.createTrack('b.mp3', false)
      expect(FakeAudio.made).toHaveLength(1)
      expect(elementOf(0).src).toBe('b.mp3')
      expect(elementOf(0).loop).toBe(false)
    })

    it('takes the element that has been back in the pool longest', () => {
      const a = deps.createTrack('a.mp3', true)
      const b = deps.createTrack('b.mp3', true)
      deps.createTrack('c.mp3', true)
      b.dispose()
      a.dispose()
      deps.createTrack('d.mp3', true)
      expect(elementOf(1).src).toBe('d.mp3')
      expect(elementOf(0).src).toBe('')
    })

    it('with every element taken, reuses the one taken longest ago; that track then rejects and touches nothing', async () => {
      const first = deps.createTrack('a.mp3', true)
      for (let i = 1; i < POOL_SIZE; i++) deps.createTrack(`s${i}.mp3`, true)
      deps.createTrack('late.mp3', true)
      expect(FakeAudio.made).toHaveLength(POOL_SIZE)
      expect(elementOf(0).src).toBe('late.mp3')
      await expect(first.ready).rejects.toThrow()
      await expect(first.play()).rejects.toMatchObject({ name: 'AbortError' })
      first.pause()
      first.fadeTo(1, 1)
      first.dispose()
      expect(elementOf(0).src).toBe('late.mp3')
      expect(elementOf(0).pauses).toBe(0)
    })

    it('a reused element carries no listeners from its previous track', () => {
      const a = deps.createTrack('a.mp3', true)
      const one = elementOf(0).listenerCount()
      expect(one).toBeGreaterThan(0)
      a.dispose()
      expect(elementOf(0).listenerCount()).toBe(0)
      deps.createTrack('b.mp3', true).dispose()
      deps.createTrack('c.mp3', true)
      expect(elementOf(0).listenerCount()).toBe(one)
    })

    it('a disposed track no longer touches the element it gave back', async () => {
      const a = await playing('a.mp3')
      a.dispose()
      const b = await playing('b.mp3')
      const pauses = elementOf(0).pauses
      a.pause()
      a.fadeTo(1, 2)
      expect(elementOf(0).pauses).toBe(pauses)
      expect(elementOf(0).paused).toBe(false)
      expect(gainOf(0).calls.filter(c => c.startsWith('curve'))).toHaveLength(0)
      b.dispose()
    })

    it('dispose clears the ready fallback timer', () => {
      const a = deps.createTrack('a.mp3', true)
      expect([...timers.values()].map(t => t.ms)).toEqual([READY_FALLBACK_SECONDS * 1000])
      a.dispose()
      expect(timers.size).toBe(0)
    })

    it('ready resolves on canplaythrough or after the fallback, and rejects on an error before start', async () => {
      const a = deps.createTrack('a.mp3', true)
      elementOf(0).dispatch('canplaythrough')
      await expect(a.ready).resolves.toBeUndefined()
      expect(timers.size).toBe(0)
      const b = deps.createTrack('b.mp3', true)
      runTimers(READY_FALLBACK_SECONDS * 1000)
      await expect(b.ready).resolves.toBeUndefined()
      const c = deps.createTrack('c.mp3', true)
      elementOf(2).dispatch('error')
      await expect(c.ready).rejects.toThrow()
    })
  })

  describe('unlock', () => {
    it('creates the whole pool and primes each element exactly once, silently, inside the gesture', async () => {
      const owned = deps.createTrack('a.mp3', true)
      const result = deps.unlock()
      expect(FakeAudio.made).toHaveLength(POOL_SIZE)
      for (const el of FakeAudio.made) {
        expect(el.plays).toHaveLength(1)
        expect(el.paused).toBe(true)
      }
      expect(elementOf(0).plays).toEqual(['a.mp3'])
      for (const el of FakeAudio.made.slice(1)) expect(el.plays).toEqual([SILENT_SRC])
      expect(await result).toBe(true)
      await deps.unlock()
      for (const el of FakeAudio.made) expect(el.plays).toHaveLength(1)
      for (let i = 0; i < POOL_SIZE; i++) expect(gainOf(i).value).toBe(0)
      owned.dispose()
    })

    it('leaves a playing element alone', async () => {
      await playing('a.mp3')
      const plays = elementOf(0).plays.length
      await deps.unlock()
      expect(elementOf(0).plays).toHaveLength(plays)
      expect(elementOf(0).paused).toBe(false)
    })

    it('does not pause an element whose play() is still in flight, and primes it on a later unlock', async () => {
      const a = deps.createTrack('a.mp3', true)
      const el = elementOf(0)
      el.play = () => { el.plays.push(el.src); el.paused = false; return new Promise<void>(() => {}) }
      void a.play()
      await flush()
      await deps.unlock()
      expect(el.plays).toEqual(['a.mp3'])
      expect(el.pauses).toBe(0)
      el.paused = true
      await deps.unlock()
      expect(el.plays).toEqual(['a.mp3', 'a.mp3'])
    })

    it('waits for resume() however long it takes: no grace bound in the gesture path', async () => {
      FakeContext.resumeMode = 'pending'
      let settled: boolean | null = null
      void deps.unlock().then(v => { settled = v })
      runTimers()
      await flush()
      expect(settled).toBeNull()
      ctx().finishResume()
      await flush()
      expect(settled).toBe(true)
    })
  })

  describe('play', () => {
    it('with a suspended context that will not resume, rejects as NotAllowedError after the grace period without calling the element', async () => {
      FakeContext.resumeMode = 'pending'
      const a = deps.createTrack('a.mp3', true)
      let error: unknown = null
      void a.play().catch(e => { error = e })
      await flush()
      expect(error).toBeNull()
      runTimers(RESUME_GRACE_MS)
      await flush()
      expect(error).toMatchObject({ name: 'NotAllowedError' })
      expect(elementOf(0).plays).toEqual([])
    })
  })

  describe('interruptions', () => {
    let interruptions: number
    let ends: number
    let track: Track

    beforeEach(async () => {
      interruptions = 0
      ends = 0
      track = await playing('a.mp3', false)
      track.onInterrupted(() => { interruptions++ })
      track.onEnded(() => { ends++ })
    })

    it('reports an error after start', () => {
      elementOf(0).dispatch('error')
      expect(interruptions).toBe(1)
    })

    it('reports a pause that the service did not ask for, but not its own', async () => {
      track.pause()
      expect(interruptions).toBe(0)
      await track.play()
      elementOf(0).pauseFromOutside()
      expect(interruptions).toBe(1)
    })

    it('reports the context leaving running while the track plays, and not while it is paused', async () => {
      ctx().setState('interrupted' as AudioContextState)
      expect(interruptions).toBe(1)
      ctx().setState('running')
      await track.play()
      track.pause()
      ctx().setState('suspended')
      expect(interruptions).toBe(1)
    })

    it('a track reaching its end is ended, not interrupted', () => {
      elementOf(0).reachEnd()
      expect(interruptions).toBe(0)
      expect(ends).toBe(1)
    })

    it('a disposed track reports nothing', () => {
      track.dispose()
      ctx().setState('suspended')
      elementOf(0).dispatch('error')
      expect(interruptions).toBe(0)
    })
  })

  describe('fades', () => {
    it('fades on an equal-power curve from the current value, cancelling what was scheduled first', () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.calls = []
      gain.value = 0.5
      a.fadeTo(1, 2)
      expect(gain.calls).toEqual([`cancel(${ctx().currentTime})`, `curve(${ctx().currentTime},2)`])
      const curve = gain.curves[0]!
      expect(curve[0]).toBeCloseTo(0.5, 5)
      expect(curve.at(-1)).toBeCloseTo(1, 5)
    })

    it('falls back to a linear ramp where the browser refuses the curve', () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.throwOnCurve = true
      a.fadeTo(1, 2)
      expect(gain.calls.at(-1)).toBe(`ramp(1,${ctx().currentTime + 2})`)
    })

    it('a crossfade keeps the summed power at 1', () => {
      const up = equalPowerCurve(0, 1, 33)
      const down = equalPowerCurve(1, 0, 33)
      expect(up[0]).toBeCloseTo(0, 6)
      expect(up.at(-1)).toBeCloseTo(1, 6)
      up.forEach((g, i) => expect(g * g + down[i]! * down[i]!).toBeCloseTo(1, 5))
      expect(up[16]).toBeCloseTo(Math.SQRT1_2, 5)
    })
  })

  describe('gestures and idling', () => {
    it('fires once on a mouse press, a touch release or a key, and not on a touch press or Escape', () => {
      let fired = 0
      deps.addGestureListener(() => { fired++ })
      doc.dispatch('pointerdown', { pointerType: 'touch' })
      doc.dispatch('keydown', { key: 'Escape' })
      expect(fired).toBe(0)
      doc.dispatch('pointerup', { pointerType: 'touch' })
      expect(fired).toBe(1)
      expect(doc.listenerCount()).toBe(0)
      deps.addGestureListener(() => { fired++ })
      doc.dispatch('pointerdown', { pointerType: 'mouse' })
      deps.addGestureListener(() => { fired++ })
      doc.dispatch('keydown', { key: 'a' })
      expect(fired).toBe(3)
    })

    it('the remover detaches the gesture listener', () => {
      let fired = 0
      const remove = deps.addGestureListener(() => { fired++ })
      remove()
      expect(doc.listenerCount()).toBe(0)
      doc.dispatch('keydown', { key: 'a' })
      expect(fired).toBe(0)
    })

    it('idle() suspends a running context', async () => {
      await deps.unlock()
      deps.idle()
      expect(ctx().suspends).toBe(1)
      expect(ctx().state).toBe('suspended')
    })

    it('wait() runs on the injected timers', async () => {
      let done = false
      void deps.wait(2).then(() => { done = true })
      runTimers(2000)
      await flush()
      expect(done).toBe(true)
    })
  })
})
