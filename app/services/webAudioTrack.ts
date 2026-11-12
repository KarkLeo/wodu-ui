import type { Interruption, SceneAudioDeps, Track } from './SceneAudio'

export const READY_FALLBACK_SECONDS = 6
export const RESUME_GRACE_MS = 250
/** Elements made once and reused: WebKit lets an element play without a gesture only after one played inside a gesture. */
export const POOL_SIZE = 6
/** Eight samples of 8-bit silence: what `unlock()` plays to bless an element that has no sound of its own yet. */
export const SILENT_SRC = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=='
/** Odd, so the curve has a sample at its midpoint. */
export const CURVE_POINTS = 33
/** How long an evicted element that is still audible ramps to silence before it takes its new src. */
export const STEAL_RAMP_MS = 30

/** What the shell takes from the browser; tests pass fakes. */
export interface WebAudioEnv {
  Audio: new () => HTMLAudioElement
  AudioContext: new () => AudioContext
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
  document: Pick<Document, 'addEventListener' | 'removeEventListener'>
}

function browserEnv(): WebAudioEnv {
  return {
    Audio: window.Audio,
    AudioContext: window.AudioContext,
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: id => window.clearTimeout(id as number),
    document: window.document,
  }
}

/**
 * Gains from `from` to `to` (both 0..1) that keep a crossfade's summed power at 1: the gain is sin(p·π/2)
 * as p walks evenly from asin(from) to asin(to), so a fade in from 0 is sin and a fade out from 1 is cos.
 */
export function equalPowerCurve(from: number, to: number, points = CURVE_POINTS): Float32Array {
  const phase = (g: number) => Math.asin(Math.min(1, Math.max(0, g)))
  const a = phase(from)
  const b = phase(to)
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i++) curve[i] = Math.sin(a + (b - a) * (i / (points - 1)))
  // Float32 rounding would leave the end a hair off the target.
  curve[points - 1] = to
  return curve
}

/**
 * The one way a gain changes: never throws. The spec refuses any automation inside an active curve's span, and some
 * browsers keep refusing after a cancel, so it tries the curve, then a linear ramp, then the bare value.
 * It starts from the value the param has now, so a fade started mid-fade carries on without a jump.
 */
function setGain(param: AudioParam, now: number, level: number, seconds: number) {
  let from = level
  try { from = param.value } catch { /* keep the target */ }
  try {
    param.cancelScheduledValues(0)
    if (seconds <= 0 || from === level) param.setValueAtTime(level, now)
    else param.setValueCurveAtTime(equalPowerCurve(from, level), now, seconds)
    return
  } catch { /* fall through to the ramp */ }
  try {
    param.cancelScheduledValues(0)
    param.setValueAtTime(from, now)
    param.linearRampToValueAtTime(level, now + Math.max(seconds, 0.001))
    return
  } catch { /* fall through to the bare value */ }
  try { param.value = level } catch { /* nothing more to try */ }
}

const isRunning = (context: AudioContext) => context.state === 'running'
const isRefusal = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError'

interface Owner {
  readonly playing: boolean
  /** The context changed state. */
  contextChanged(): void
  /** Another track takes the element: this one goes dead. */
  evict(): void
}

interface Slot {
  element: HTMLAudioElement
  gain: GainNode
  /** A play() inside a gesture was allowed on it: WebKit then lets it play without one. */
  primed: boolean
  owner: Owner | null
  /** A channel's current or held track: never evicted. */
  pinned: boolean
  /** Where its last fade was going; 0 means fading out or silent. */
  lastTarget: number | null
  freedAt: number
  takenAt: number
}

// Gain nodes, not element.volume: iOS ignores the latter.
export function webAudioDeps(env: WebAudioEnv = browserEnv()): SceneAudioDeps {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let masterLevel = 1
  const slots: Slot[] = []
  let clock = 0

  function graph() {
    if (!context || !master) {
      const made = new env.AudioContext()
      context = made
      master = made.createGain()
      master.gain.value = masterLevel
      master.connect(made.destination)
      made.addEventListener('statechange', () => {
        slots.forEach(s => s.owner?.contextChanged())
      })
    }
    return { context, master }
  }

  // Without a user gesture some browsers leave resume() pending forever, so the no-gesture path never waits on it open-endedly.
  async function resumeBounded(context: AudioContext): Promise<boolean> {
    if (isRunning(context)) return true
    let timer: unknown
    try {
      const attempt = Promise.resolve(context.resume()).catch(() => {})
      await Promise.race([attempt, new Promise<void>(resolve => { timer = env.setTimeout(resolve, RESUME_GRACE_MS) })])
    } catch { /* resume() threw synchronously */ }
    env.clearTimeout(timer)
    return isRunning(context)
  }

  function makeSlot(): Slot {
    const { context, master } = graph()
    const element = new env.Audio()
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    const gain = context.createGain()
    gain.gain.value = 0
    context.createMediaElementSource(element).connect(gain)
    gain.connect(master)
    const slot: Slot = { element, gain, primed: false, owner: null, pinned: false, lastTarget: null, freedAt: 0, takenAt: 0 }
    slots.push(slot)
    return slot
  }

  const oldest = (list: Slot[], by: 'freedAt' | 'takenAt') => list.reduce((a, b) => (b[by] < a[by] ? b : a))

  // A free element silent longest first, then a new one while the pool has room; with every element taken, an
  // unpinned one fading out or silent, then the unpinned one taken longest ago.
  function takeSlot(): Slot {
    const free = slots.filter(s => !s.owner)
    if (free.length) return oldest(free, 'freedAt')
    if (slots.length < POOL_SIZE) return makeSlot()
    const open = slots.filter(s => !s.pinned)
    const candidates = open.length ? open : slots
    const fading = candidates.filter(s => s.lastTarget === 0)
    return oldest(fading.length ? fading : candidates, 'takenAt')
  }

  // Must run synchronously inside the gesture: WebKit blesses an element on a play() called there. Whether it did is
  // known only from the outcome: a refusal leaves the slot unprimed for the next unlock, and the AbortError from the
  // pause right after an allowed play counts as primed.
  function prime(slot: Slot) {
    if (slot.primed) return
    const { element } = slot
    // Playing, or a play() of the service's in flight, which a pause here would abort.
    if (!element.paused) {
      if (slot.owner?.playing) slot.primed = true
      return
    }
    const free = !slot.owner
    if (free) {
      element.loop = false
      element.src = SILENT_SRC
    }
    try {
      Promise.resolve(element.play()).then(
        () => { slot.primed = true },
        e => { if (!isRefusal(e)) slot.primed = true },
      )
    } catch { /* play() threw synchronously: try again next time */ }
    element.pause()
    // WebKit keeps the blessing on the element, not on its source, so the free element goes back to its empty state.
    if (free) {
      element.removeAttribute('src')
      element.load()
    }
  }

  function createTrack(src: string, loop: boolean): Track {
    const { context } = graph()
    const slot = takeSlot()
    const { element, gain } = slot
    const audible = !!slot.owner?.playing
    slot.owner?.evict()
    if (audible) setGain(gain.gain, context.currentTime, 0, STEAL_RAMP_MS / 1000)

    let dead = false
    let playing = false
    let stalled: Interruption | null = null
    const interrupted: Array<(cause: Interruption) => void> = []
    const resumed: Array<() => void> = []
    const ended: Array<() => void> = []
    const detachers: Array<() => void> = []
    let beginTimer: unknown

    function on(type: string, listener: () => void) {
      element.addEventListener(type, listener)
      detachers.push(() => element.removeEventListener(type, listener))
    }

    function interrupt(cause: Interruption) {
      if (!playing) return
      playing = false
      stalled = cause
      interrupted.forEach(l => l(cause))
    }

    // The browser plays it again by itself (WebKit after a call or the lock screen): what the service expects again.
    function comeBack() {
      if (!stalled || stalled === 'error' || element.paused || !isRunning(context)) return
      stalled = null
      playing = true
      resumed.forEach(l => l())
    }

    let settle!: { resolve: () => void, reject: (e: Error) => void }
    const ready = new Promise<void>((resolve, reject) => { settle = { resolve, reject } })
    ready.catch(() => {})
    // iPhones ignore preload and may never fire canplaythrough before play().
    const readyTimer = env.setTimeout(() => settle.resolve(), READY_FALLBACK_SECONDS * 1000)

    function begin() {
      on('canplaythrough', () => {
        env.clearTimeout(readyTimer)
        settle.resolve()
      })
      on('error', () => {
        env.clearTimeout(readyTimer)
        if (playing) interrupt('error')
        else settle.reject(new Error(`Cannot load ${src}`))
      })
      // The service's own pause() clears `playing` first; a pause event that finds the element playing again is a stale one.
      on('pause', () => {
        if (element.paused && !element.ended) interrupt('paused')
      })
      on('playing', comeBack)
      on('ended', () => {
        if (!playing) return
        playing = false
        ended.forEach(l => l())
      })
      setGain(gain.gain, context.currentTime, 0, 0)
      element.loop = loop
      element.src = src
      element.load()
    }

    function detach() {
      dead = true
      playing = false
      env.clearTimeout(readyTimer)
      env.clearTimeout(beginTimer)
      detachers.splice(0).forEach(d => d())
    }

    slot.owner = {
      get playing() { return playing },
      contextChanged() {
        if (!isRunning(context)) interrupt('suspended')
        else comeBack()
      },
      evict() {
        detach()
        settle.reject(new Error(`Released ${src} for another track`))
      },
    }
    slot.takenAt = ++clock
    slot.pinned = false
    slot.lastTarget = null
    // An evicted sound fades out over a few milliseconds instead of being cut by the new src.
    if (audible) beginTimer = env.setTimeout(begin, STEAL_RAMP_MS)
    else begin()

    return {
      ready,
      async play() {
        if (dead) throw new DOMException('Track was released', 'AbortError')
        if (!await resumeBounded(context)) throw new DOMException('Audio context is suspended', 'NotAllowedError')
        if (dead) throw new DOMException('Track was released', 'AbortError')
        await element.play()
        // Evicted while the element was starting: it now plays another track's src.
        if (dead) throw new DOMException('Track was released', 'AbortError')
        playing = true
        stalled = null
      },
      pause() {
        if (dead) return
        playing = false
        stalled = null
        element.pause()
      },
      fadeTo(level, seconds) {
        if (dead) return
        slot.lastTarget = level
        setGain(gain.gain, context.currentTime, level, seconds)
      },
      onEnded: listener => { ended.push(listener) },
      onInterrupted: listener => { interrupted.push(listener) },
      onResumed: listener => { resumed.push(listener) },
      pin() { if (!dead) slot.pinned = true },
      unpin() { if (!dead) slot.pinned = false },
      dispose() {
        if (dead) return
        detach()
        element.pause()
        element.removeAttribute('src')
        element.load()
        setGain(gain.gain, context.currentTime, 0, 0)
        slot.owner = null
        slot.pinned = false
        slot.lastTarget = null
        slot.freedAt = ++clock
      },
    }
  }

  return {
    createTrack,
    wait: seconds => new Promise(resolve => { env.setTimeout(resolve, seconds * 1000) }),
    setMasterVolume(level) {
      masterLevel = level
      if (context && master) setGain(master.gain, context.currentTime, level, 0)
    },
    // Every call primes what is still unprimed and asks for a resume inside its own gesture, even while an earlier
    // resume is still pending: that one may never settle outside activation.
    async unlock() {
      const { context } = graph()
      while (slots.length < POOL_SIZE) makeSlot()
      slots.forEach(prime)
      if (isRunning(context)) return true
      try {
        await context.resume()
      } catch { /* refused: the state says so */ }
      return isRunning(context)
    },
    // Not one-shot: an event that turns out to carry no activation (the touchend of a scroll) must not use the listener up.
    addGestureListener(callback) {
      const types = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']
      const handler = (event: Event) => {
        if (activates(event)) callback()
      }
      types.forEach(type => env.document.addEventListener(type, handler, true))
      return () => types.forEach(type => env.document.removeEventListener(type, handler, true))
    },
  }
}

// The events that carry user activation: a mouse press, a touch or pen release, a click, a key other than Escape.
function activates(event: Event): boolean {
  if (event.type === 'keydown') return (event as KeyboardEvent).key !== 'Escape'
  if (event.type === 'touchend' || event.type === 'click') return true
  const mouse = (event as PointerEvent).pointerType === 'mouse'
  return event.type === 'pointerdown' ? mouse : !mouse
}
