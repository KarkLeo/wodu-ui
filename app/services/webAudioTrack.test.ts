import { describe, it, expect, beforeEach } from 'vitest'
import { createAudioMixer, createSceneAudio, type Interruption, type SceneAudioDeps, type Track } from './SceneAudio'
import {
  CURVE_POINTS,
  equalPowerCurve,
  ONE_SHOT_READY_FALLBACK_SECONDS,
  POOL_SIZE,
  READY_FALLBACK_SECONDS,
  RESUME_GRACE_MS,
  SILENT_SRC,
  STEAL_RAMP_MS,
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

// Plays like a media element: a refused play() rejects NotAllowedError at once; an allowed one settles a microtask
// later, unless pause() or load() comes first, which reject it with AbortError.
class FakeAudio extends FakeTarget {
  static made: FakeAudio[] = []
  /** Whether play() is allowed (inside a gesture, or after the element was blessed). */
  static allowPlay = true
  private _src = ''
  /** Every src assignment, with the crossOrigin in force at that moment. */
  srcSets: Array<{ src: string, crossOrigin: string | null }> = []
  loop = false
  paused = true
  ended = false
  crossOrigin: string | null = null
  preload = ''
  plays: string[] = []
  outcomes: Array<'resolved' | 'NotAllowedError' | 'AbortError'> = []
  pauses = 0
  private pending: { resolve: () => void, reject: (e: Error) => void } | null = null
  constructor() {
    super()
    FakeAudio.made.push(this)
  }
  get src() { return this._src }
  set src(value: string) {
    this._src = value
    this.srcSets.push({ src: value, crossOrigin: this.crossOrigin })
  }
  play() {
    this.plays.push(this._src)
    if (!FakeAudio.allowPlay) {
      this.outcomes.push('NotAllowedError')
      return Promise.reject(new DOMException('needs a gesture', 'NotAllowedError'))
    }
    this.paused = false
    return new Promise<void>((resolve, reject) => {
      const entry = { resolve, reject }
      this.pending = entry
      queueMicrotask(() => {
        if (this.pending !== entry) return
        this.pending = null
        this.outcomes.push('resolved')
        resolve()
      })
    })
  }
  private abortPending() {
    if (!this.pending) return
    this.pending.reject(new DOMException('interrupted', 'AbortError'))
    this.pending = null
    this.outcomes.push('AbortError')
  }
  // Real browsers queue the event; firing it at once is the harder case for the "not ours" check.
  pause() {
    this.pauses++
    this.abortPending()
    const was = this.paused
    this.paused = true
    if (!was) this.dispatch('pause')
  }
  load() {
    this.abortPending()
    this.paused = true
  }
  removeAttribute(name: string) {
    if (name === 'src') this._src = ''
  }
  /** The browser pauses it: media keys, a call, the lock screen. */
  pauseFromOutside() {
    this.paused = true
    this.dispatch('pause')
  }
  /** The browser plays it again by itself. */
  resumeFromOutside() {
    this.paused = false
    this.dispatch('playing')
  }
  reachEnd() {
    this.ended = true
    this.paused = true
    this.dispatch('pause')
    this.dispatch('ended')
  }
}

// An AudioParam that, like the spec, refuses any automation inside an active curve's span. `hostile` keeps the
// curve even after cancelScheduledValues, as no browser should but some have, so every later call throws.
class FakeParam {
  static hostile = false
  private _value = 0
  calls: string[] = []
  curves: number[][] = []
  throwOnCurve = false
  throwOnRamp = false
  private span: { start: number, end: number } | null = null
  constructor(private readonly now: () => number) {}
  private guard(name: string, t = this.now()) {
    if (this.span && t >= this.span.start && t < this.span.end) throw new DOMException(`${name} inside a curve`, 'NotSupportedError')
  }
  get value() { return this._value }
  set value(v: number) {
    this.guard('value')
    this.calls.push(`value=${v}`)
    this._value = v
  }
  cancelScheduledValues(t: number) {
    this.calls.push(`cancel(${t})`)
    if (!FakeParam.hostile) this.span = null
  }
  setValueAtTime(v: number, t: number) {
    this.guard('setValueAtTime', t)
    this.calls.push(`set(${v},${t})`)
    this._value = v
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.guard('linearRamp', this.now())
    if (this.throwOnRamp) throw new DOMException('no ramp', 'NotSupportedError')
    this.calls.push(`ramp(${v},${t})`)
  }
  setValueCurveAtTime(curve: Float32Array, t: number, d: number) {
    this.guard('setValueCurve', t)
    if (this.throwOnCurve) throw new DOMException('overlaps', 'NotSupportedError')
    this.calls.push(`curve(${t},${d})`)
    this.curves.push([...curve])
    this.span = { start: t, end: t + d }
  }
}

class FakeGain {
  gain: FakeParam
  constructor(now: () => number) { this.gain = new FakeParam(now) }
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
  private pendingResumes: Array<() => void> = []
  constructor() {
    super()
    FakeContext.made.push(this)
  }
  createGain() {
    const g = new FakeGain(() => this.currentTime)
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
    return new Promise<void>(resolve => { this.pendingResumes.push(resolve) })
  }
  finishResume() {
    this.setState('running')
    this.pendingResumes.splice(0).forEach(r => r())
  }
  suspend() {
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
  const fill = () => Array.from({ length: POOL_SIZE }, (_, i) => deps.createTrack(`s${i}.mp3`, true))

  beforeEach(() => {
    FakeAudio.made = []
    FakeAudio.allowPlay = true
    FakeContext.made = []
    FakeContext.resumeMode = 'run'
    FakeParam.hostile = false
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
      for (let i = 0; i < POOL_SIZE + 2; i++) alive.push(deps.createTrack(`burst${i}.mp3`, true))
      expect(POOL_SIZE).toBe(6)
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

    it('sets crossOrigin before the first src, and it is still set on reuse', () => {
      deps.createTrack('a.mp3', true).dispose()
      deps.createTrack('b.mp3', true)
      expect(elementOf(0).srcSets).toEqual([
        { src: 'a.mp3', crossOrigin: 'anonymous' },
        { src: 'b.mp3', crossOrigin: 'anonymous' },
      ])
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

    it('with every element taken, evicts one whose last fade went to 0 before an older one', () => {
      const tracks = fill()
      tracks[3]!.fadeTo(0, 1)
      deps.createTrack('late.mp3', true)
      expect(FakeAudio.made).toHaveLength(POOL_SIZE)
      expect(elementOf(3).src).toBe('late.mp3')
      expect(elementOf(0).src).toBe('s0.mp3')
    })

    it('otherwise evicts the one taken longest ago, but never a pinned one', () => {
      const tracks = fill()
      tracks[0]!.pin()
      tracks[2]!.pin()
      tracks[2]!.fadeTo(0, 1)
      deps.createTrack('late.mp3', true)
      expect(elementOf(0).src).toBe('s0.mp3')
      expect(elementOf(2).src).toBe('s2.mp3')
      expect(elementOf(1).src).toBe('late.mp3')
    })

    it('an unpinned track can be evicted again', () => {
      const tracks = fill()
      tracks[0]!.pin()
      tracks[0]!.unpin()
      deps.createTrack('late.mp3', true)
      expect(elementOf(0).src).toBe('late.mp3')
    })

    it('an evicted track rejects and no longer touches its old element', async () => {
      const [first] = fill()
      deps.createTrack('late.mp3', true)
      expect(elementOf(0).src).toBe('late.mp3')
      await expect(first!.ready).rejects.toThrow()
      await expect(first!.play()).rejects.toMatchObject({ name: 'AbortError' })
      first!.pause()
      first!.fadeTo(1, 1)
      first!.dispose()
      expect(elementOf(0).src).toBe('late.mp3')
      expect(elementOf(0).pauses).toBe(0)
    })

    it('a track evicted while its element\'s play() is in flight rejects with AbortError instead of resolving', async () => {
      const tracks = fill()
      const el = elementOf(0)
      let settleElement!: () => void
      el.play = () => { el.plays.push(el.src); el.paused = false; return new Promise<void>(resolve => { settleElement = resolve }) }
      let outcome: unknown = 'pending'
      void tracks[0]!.play().then(() => { outcome = 'resolved' }, e => { outcome = e })
      await flush()
      expect(el.plays).toEqual(['s0.mp3'])
      deps.createTrack('late.mp3', true)
      settleElement(); await flush()
      expect(outcome).toMatchObject({ name: 'AbortError' })
    })

    it('an evicted track that is still audible is ramped to 0 over a few milliseconds before its element changes src', async () => {
      const tracks = fill()
      await tracks[3]!.play()
      // The fake param does not follow its curve: give it the value a fade out would have reached by now.
      gainOf(3).value = 0.8
      tracks[3]!.fadeTo(0, 2)
      gainOf(3).calls = []
      deps.createTrack('late.mp3', true)
      expect(elementOf(3).src).toBe('s3.mp3')
      expect(gainOf(3).calls.at(-1)).toMatch(/^curve\(10,0\.0\d+\)$/)
      runTimers(STEAL_RAMP_MS)
      expect(elementOf(3).src).toBe('late.mp3')
      expect(gainOf(3).value).toBe(0)
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

    it('a one-shot is ready on canplay or after its shorter fallback; a loop waits for canplaythrough', async () => {
      expect(ONE_SHOT_READY_FALLBACK_SECONDS).toBe(1.5)
      const shot = deps.createTrack('a.mp3', false)
      expect([...timers.values()].map(t => t.ms)).toEqual([ONE_SHOT_READY_FALLBACK_SECONDS * 1000])
      elementOf(0).dispatch('canplay')
      await expect(shot.ready).resolves.toBeUndefined()
      expect(timers.size).toBe(0)
      const late = deps.createTrack('b.mp3', false)
      runTimers(ONE_SHOT_READY_FALLBACK_SECONDS * 1000)
      await expect(late.ready).resolves.toBeUndefined()
      let loopReady = false
      const loop = deps.createTrack('c.mp3', true)
      void loop.ready.then(() => { loopReady = true })
      elementOf(2).dispatch('canplay')
      await flush()
      expect(loopReady).toBe(false)
      expect([...timers.values()].map(t => t.ms)).toEqual([READY_FALLBACK_SECONDS * 1000])
      elementOf(2).dispatch('canplaythrough')
      await flush()
      expect(loopReady).toBe(true)
    })
  })

  describe('unlock', () => {
    it('creates the whole pool and primes each element once, silently, inside the gesture; free ones end without a src', async () => {
      const owned = deps.createTrack('a.mp3', true)
      const result = deps.unlock()
      expect(FakeAudio.made).toHaveLength(POOL_SIZE)
      for (const el of FakeAudio.made) {
        expect(el.plays).toHaveLength(1)
        expect(el.paused).toBe(true)
      }
      expect(elementOf(0).plays).toEqual(['a.mp3'])
      expect(elementOf(0).src).toBe('a.mp3')
      for (const el of FakeAudio.made.slice(1)) {
        expect(el.plays).toEqual([SILENT_SRC])
        expect(el.src).toBe('')
      }
      expect(await result).toBe(true)
      await flush()
      for (const el of FakeAudio.made) expect(el.outcomes).toEqual(['AbortError'])
      await deps.unlock()
      for (const el of FakeAudio.made) expect(el.plays).toHaveLength(1)
      for (let i = 0; i < POOL_SIZE; i++) expect(gainOf(i).value).toBe(0)
      owned.dispose()
    })

    it('a refused prime leaves the element unprimed, and the next unlock primes it again', async () => {
      FakeAudio.allowPlay = false
      FakeContext.resumeMode = 'pending'
      void deps.unlock()
      await flush()
      for (const el of FakeAudio.made) expect(el.outcomes).toEqual(['NotAllowedError'])
      FakeAudio.allowPlay = true
      void deps.unlock()
      await flush()
      for (const el of FakeAudio.made) expect(el.outcomes).toEqual(['NotAllowedError', 'AbortError'])
      void deps.unlock()
      await flush()
      for (const el of FakeAudio.made) expect(el.plays).toHaveLength(2)
    })

    it('an unlock whose resume() never settles does not stop a later one: it primes again and resumes in its own gesture', async () => {
      FakeContext.resumeMode = 'pending'
      FakeAudio.allowPlay = false
      let first: boolean | null = null
      void deps.unlock().then(v => { first = v })
      runTimers()
      await flush()
      expect(first).toBeNull()
      FakeAudio.allowPlay = true
      ctx().resumeMode = 'run'
      expect(await deps.unlock()).toBe(true)
      expect(ctx().resumes).toBe(2)
      for (const el of FakeAudio.made) expect(el.plays).toHaveLength(2)
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
      el.play = () => { el.plays.push(el.src); return Promise.reject(new DOMException('aborted', 'AbortError')) }
      await deps.unlock()
      expect(el.plays).toEqual(['a.mp3', 'a.mp3'])
    })

    it('primed() is true once an unlock has primed every element of the pool, and stays so', async () => {
      expect(deps.primed()).toBe(false)
      FakeAudio.allowPlay = false
      await deps.unlock()
      expect(deps.primed()).toBe(false)
      FakeAudio.allowPlay = true
      await deps.unlock()
      expect(deps.primed()).toBe(true)
      await deps.unlock()
      expect(deps.primed()).toBe(true)
    })

    it('primed() is false while an element whose play was in flight is left for a later unlock', async () => {
      const a = deps.createTrack('a.mp3', true)
      const el = elementOf(0)
      el.play = () => { el.plays.push(el.src); el.paused = false; return new Promise<void>(() => {}) }
      void a.play()
      await flush()
      await deps.unlock()
      expect(deps.primed()).toBe(false)
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
    let causes: Interruption[]
    let resumes: number
    let ends: number
    let track: Track

    beforeEach(async () => {
      causes = []
      resumes = 0
      ends = 0
      track = await playing('a.mp3', false)
      track.onInterrupted(cause => { causes.push(cause) })
      track.onResumed(() => { resumes++ })
      track.onEnded(() => { ends++ })
    })

    it('reports an error after start', () => {
      elementOf(0).dispatch('error')
      expect(causes).toEqual(['error'])
    })

    it('reports a pause that the service did not ask for, but not its own', async () => {
      track.pause()
      expect(causes).toEqual([])
      await track.play()
      elementOf(0).pauseFromOutside()
      expect(causes).toEqual(['paused'])
    })

    it('reports the context leaving running while the track plays, and not while it is paused', async () => {
      ctx().setState('interrupted' as AudioContextState)
      expect(causes).toEqual(['suspended'])
      ctx().setState('running')
      await track.play()
      track.pause()
      ctx().setState('suspended')
      expect(causes).toEqual(['suspended'])
    })

    it('reports the browser resuming a track paused from outside, and a later outside pause again', () => {
      elementOf(0).pauseFromOutside()
      elementOf(0).resumeFromOutside()
      expect(resumes).toBe(1)
      elementOf(0).pauseFromOutside()
      expect(causes).toEqual(['paused', 'paused'])
    })

    it('a playing event while the context is not running is no resume', () => {
      elementOf(0).pauseFromOutside()
      ctx().setState('suspended')
      elementOf(0).resumeFromOutside()
      expect(resumes).toBe(0)
    })

    it('reports the context coming back by itself after it interrupted the track', () => {
      ctx().setState('interrupted' as AudioContextState)
      ctx().setState('running')
      expect(resumes).toBe(1)
      ctx().setState('suspended')
      expect(causes).toEqual(['suspended', 'suspended'])
    })

    it('a playing event after the service\'s own play is no resume', async () => {
      track.pause()
      await track.play()
      elementOf(0).dispatch('playing')
      expect(resumes).toBe(0)
    })

    it('a track reaching its end is ended, not interrupted', () => {
      elementOf(0).reachEnd()
      expect(causes).toEqual([])
      expect(ends).toBe(1)
    })

    it('a disposed track reports nothing', () => {
      track.dispose()
      ctx().setState('suspended')
      elementOf(0).dispatch('error')
      expect(causes).toEqual([])
    })
  })

  describe('fades', () => {
    it(`fades on an equal-power curve of ${CURVE_POINTS} points from the current value, cancelling everything first`, () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.calls = []
      a.fadeTo(1, 2)
      expect(gain.calls).toEqual(['cancel(0)', 'curve(10,2)'])
      const curve = gain.curves[0]!
      expect(curve).toHaveLength(CURVE_POINTS)
      expect(CURVE_POINTS % 2).toBe(1)
      expect(curve[0]).toBeCloseTo(0, 5)
      expect(curve[(CURVE_POINTS - 1) / 2]).toBeCloseTo(Math.SQRT1_2, 4)
      expect(curve.at(-1)).toBe(1)
    })

    it('starts a new fade from the gain the last one has reached', () => {
      const a = deps.createTrack('a.mp3', true)
      a.fadeTo(1, 2)
      const gain = gainOf(0)
      ctx().currentTime = 13
      gain.value = 0.5
      a.fadeTo(0, 2)
      const curve = gain.curves[1]!
      expect(curve[0]).toBeCloseTo(0.5, 5)
      expect(curve.at(-1)).toBe(0)
    })

    it('sets the value at once when it already equals the target', () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.calls = []
      a.fadeTo(0, 2)
      expect(gain.calls).toEqual(['cancel(0)', 'set(0,10)'])
    })

    it('falls back to a linear ramp where the browser refuses the curve', () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.throwOnCurve = true
      a.fadeTo(1, 2)
      expect(gain.calls.at(-1)).toBe('ramp(1,12)')
    })

    it('sets the value directly where the ramp is refused too', () => {
      const a = deps.createTrack('a.mp3', true)
      const gain = gainOf(0)
      gain.throwOnCurve = true
      gain.throwOnRamp = true
      a.fadeTo(1, 2)
      expect(gain.value).toBe(1)
    })

    it('no fade, pause or dispose throws, even when every automation call does', async () => {
      FakeParam.hostile = true
      const a = await playing('a.mp3')
      a.fadeTo(1, 2)
      expect(() => a.fadeTo(0, 2)).not.toThrow()
      expect(() => a.pause()).not.toThrow()
      expect(() => a.dispose()).not.toThrow()
      expect(elementOf(0).src).toBe('')
      expect(() => deps.createTrack('b.mp3', true)).not.toThrow()
      expect(elementOf(0).src).toBe('b.mp3')
    })

    it('a crossfade keeps the summed power at 1', () => {
      const up = equalPowerCurve(0, 1)
      const down = equalPowerCurve(1, 0)
      up.forEach((g, i) => expect(g * g + down[i]! * down[i]!).toBeCloseTo(1, 5))
    })
  })

  describe('with the service, when automation throws inside a curve', () => {
    beforeEach(() => { FakeParam.hostile = true })

    it('a scene switch mid-fade completes: the old track ends paused and returned, the new one plays', async () => {
      const audio = createSceneAudio(deps)
      audio.setScene('a.mp3')
      elementOf(0).dispatch('canplaythrough'); await flush()
      audio.setScene('b.mp3')
      elementOf(1).dispatch('canplaythrough'); await flush()
      expect(elementOf(1).paused).toBe(false)
      runTimers(2000); await flush()
      expect(elementOf(0).paused).toBe(true)
      expect(elementOf(0).src).toBe('')
      expect(elementOf(0).listenerCount()).toBe(0)
      audio.setScene('c.mp3')
      expect(elementOf(0).src).toBe('c.mp3')
    })

    it('a release during a hold fade completes', async () => {
      const ch = createAudioMixer(deps).channel()
      ch.request({ key: 'a', src: 'a.mp3', loop: true, fade: 2 })
      elementOf(0).dispatch('canplaythrough'); await flush()
      expect(() => ch.hold(1)).not.toThrow()
      expect(() => ch.release(1)).not.toThrow()
      runTimers(1000); await flush()
      expect(elementOf(0).paused).toBe(false)
      expect(ch.blocked.value).toBe(false)
    })

    it('a steal of a fading element completes', async () => {
      const tracks = fill()
      await tracks[3]!.play()
      tracks[3]!.fadeTo(1, 2)
      tracks[3]!.fadeTo(0, 2)
      expect(() => deps.createTrack('late.mp3', true)).not.toThrow()
      runTimers(STEAL_RAMP_MS)
      expect(elementOf(3).src).toBe('late.mp3')
    })
  })

  describe('the pool at the worst case of two channels', () => {
    const el = (src: string) => FakeAudio.made.find(e => e.src === src)
    // As a browser does: canplay first (a one-shot is ready), then canplaythrough (a loop is).
    const ready = async (src: string) => {
      el(src)!.dispatch('canplay')
      el(src)!.dispatch('canplaythrough')
      await flush(); await flush()
    }

    // Live at once: the held scene, the scene's incoming (loading, then prepared), the overlay's current and incoming,
    // and every overlay crossfaded away, none of whose fades is allowed to finish.
    it(`with ${POOL_SIZE} elements, overlay crossfades never take the held scene, its incoming track or the overlay's current one`, async () => {
      const audio = createSceneAudio(deps)
      audio.setScene('a.mp3'); await ready('a.mp3')
      expect(el('a.mp3')!.paused).toBe(false)
      audio.setScene('b.mp3')
      const survivors = (overlay: string | null) => {
        expect(el('a.mp3')).toBeDefined()
        expect(el('b.mp3')).toBeDefined()
        if (overlay) expect(el(overlay)!.paused).toBe(false)
      }
      for (let i = 1; i <= 10; i++) {
        audio.setOverlay({ key: `k${i}`, src: `o${i}.mp3`, loop: false })
        runTimers(STEAL_RAMP_MS)
        survivors(i > 1 ? `o${i - 1}.mp3` : null)
        await ready(`o${i}.mp3`)
        survivors(`o${i}.mp3`)
        // Half way, the scene's incoming becomes ready while held: prepared, silent.
        if (i === 5) {
          await ready('b.mp3')
          expect(el('b.mp3')!.paused).toBe(true)
        }
      }
      expect(FakeAudio.made).toHaveLength(POOL_SIZE)
      // An overlay incoming still loading while another plays: the fourth live track.
      audio.setOverlay({ key: 'k11', src: 'o11.mp3', loop: false })
      runTimers(STEAL_RAMP_MS)
      survivors('o10.mp3')
      expect(el('o11.mp3')).toBeDefined()
      audio.setOverlay(null); await flush(); await flush()
      expect(el('b.mp3')!.paused).toBe(false)
      runTimers(1000); runTimers(2000); await flush()
      expect(el('a.mp3')).toBeUndefined()
      expect(el('b.mp3')!.paused).toBe(false)
    })
  })

  describe('gestures', () => {
    it('fires on every mouse press, touch release, click or key until removed, and not on a touch press or Escape', () => {
      let fired = 0
      const remove = deps.addGestureListener(() => { fired++ })
      doc.dispatch('pointerdown', { pointerType: 'touch' })
      doc.dispatch('keydown', { key: 'Escape' })
      expect(fired).toBe(0)
      doc.dispatch('pointerup', { pointerType: 'touch' })
      doc.dispatch('touchend')
      doc.dispatch('click')
      expect(fired).toBe(3)
      doc.dispatch('pointerdown', { pointerType: 'mouse' })
      doc.dispatch('pointerup', { pointerType: 'mouse' })
      doc.dispatch('keydown', { key: 'a' })
      expect(fired).toBe(5)
      remove()
      expect(doc.listenerCount()).toBe(0)
      doc.dispatch('click')
      expect(fired).toBe(5)
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
