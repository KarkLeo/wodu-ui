import type { SceneAudioDeps, Track } from './SceneAudio'

export const READY_FALLBACK_SECONDS = 6
export const RESUME_GRACE_MS = 250
/** Elements made once and reused: WebKit lets an element play without a gesture only after one played inside a gesture. */
export const POOL_SIZE = 4
/** Eight samples of 8-bit silence: what `unlock()` plays to bless an element that has no sound of its own yet. */
export const SILENT_SRC = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=='
const CURVE_POINTS = 32

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
  return curve
}

// Starts from the value the param has now, so a fade started mid-fade carries on without a jump.
function fadeParam(param: AudioParam, now: number, level: number, seconds: number) {
  const from = param.value
  param.cancelScheduledValues(now)
  if (seconds <= 0 || from === level) {
    param.setValueAtTime(level, now)
    return
  }
  const curve = equalPowerCurve(from, level)
  // Float32 rounding would leave the end a hair off `level`.
  curve[curve.length - 1] = level
  try {
    param.setValueCurveAtTime(curve, now, seconds)
  } catch {
    // Some browsers refuse a curve next to any scheduled event, even a cancelled one.
    param.setValueAtTime(from, now)
    param.linearRampToValueAtTime(level, now + seconds)
  }
}

const isRunning = (context: AudioContext) => context.state === 'running'

interface Owner {
  readonly playing: boolean
  /** The context left `running`. */
  contextStopped(): void
  /** Another track takes the element: this one goes dead. */
  evict(): void
}

interface Slot {
  element: HTMLAudioElement
  gain: GainNode
  primed: boolean
  owner: Owner | null
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
        if (!isRunning(made)) slots.forEach(s => s.owner?.contextStopped())
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
    const slot: Slot = { element, gain, primed: false, owner: null, freedAt: 0, takenAt: 0 }
    slots.push(slot)
    return slot
  }

  const oldest = (list: Slot[], by: 'freedAt' | 'takenAt') => list.reduce((a, b) => (b[by] < a[by] ? b : a))

  // A free element silent longest first, then a new one while the pool has room, then the one taken longest ago.
  function takeSlot(): Slot {
    const free = slots.filter(s => !s.owner)
    const slot = free.length ? oldest(free, 'freedAt') : slots.length < POOL_SIZE ? makeSlot() : oldest(slots, 'takenAt')
    slot.owner?.evict()
    slot.takenAt = ++clock
    return slot
  }

  // Must run synchronously inside the gesture: WebKit blesses an element on a play() called there, whatever happens next.
  function prime(slot: Slot) {
    if (slot.primed) return
    const { element } = slot
    // Playing, or a play() of the service's in flight, which a pause here would abort: left for the next unlock unless it plays.
    if (!element.paused) {
      slot.primed = !!slot.owner?.playing
      return
    }
    slot.primed = true
    if (!slot.owner) {
      element.loop = false
      element.src = SILENT_SRC
    }
    try {
      Promise.resolve(element.play()).catch(() => {})
    } catch { /* play() threw synchronously */ }
    element.pause()
  }

  function createTrack(src: string, loop: boolean): Track {
    const { context } = graph()
    const slot = takeSlot()
    const { element, gain } = slot
    let dead = false
    let playing = false
    const interrupted: Array<() => void> = []
    const ended: Array<() => void> = []
    const detachers: Array<() => void> = []

    function on(type: string, listener: () => void) {
      element.addEventListener(type, listener)
      detachers.push(() => element.removeEventListener(type, listener))
    }

    function interrupt() {
      if (!playing) return
      playing = false
      interrupted.forEach(l => l())
    }

    let settle!: { resolve: () => void, reject: (e: Error) => void }
    const ready = new Promise<void>((resolve, reject) => { settle = { resolve, reject } })
    ready.catch(() => {})
    // iPhones ignore preload and may never fire canplaythrough before play().
    const timer = env.setTimeout(() => settle.resolve(), READY_FALLBACK_SECONDS * 1000)
    on('canplaythrough', () => {
      env.clearTimeout(timer)
      settle.resolve()
    })
    on('error', () => {
      env.clearTimeout(timer)
      if (playing) interrupt()
      else settle.reject(new Error(`Cannot load ${src}`))
    })
    // The service's own pause() clears `playing` first; a pause event that finds the element playing again is a stale one.
    on('pause', () => {
      if (element.paused && !element.ended) interrupt()
    })
    on('ended', () => {
      if (!playing) return
      playing = false
      ended.forEach(l => l())
    })

    function detach() {
      dead = true
      playing = false
      env.clearTimeout(timer)
      detachers.splice(0).forEach(d => d())
    }

    slot.owner = {
      get playing() { return playing },
      contextStopped: interrupt,
      evict() {
        detach()
        settle.reject(new Error(`Released ${src} for another track`))
      },
    }
    gain.gain.cancelScheduledValues(context.currentTime)
    gain.gain.value = 0
    element.loop = loop
    element.src = src
    element.load()

    return {
      ready,
      async play() {
        if (dead) throw new DOMException('Track was released', 'AbortError')
        if (!await resumeBounded(context)) throw new DOMException('Audio context is suspended', 'NotAllowedError')
        if (dead) throw new DOMException('Track was released', 'AbortError')
        await element.play()
        if (!dead) playing = true
      },
      pause() {
        if (dead) return
        playing = false
        element.pause()
      },
      fadeTo(level, seconds) {
        if (dead) return
        fadeParam(gain.gain, context.currentTime, level, seconds)
      },
      onEnded: listener => { ended.push(listener) },
      onInterrupted: listener => { interrupted.push(listener) },
      dispose() {
        if (dead) return
        detach()
        element.pause()
        element.removeAttribute('src')
        element.load()
        gain.gain.cancelScheduledValues(context.currentTime)
        gain.gain.value = 0
        slot.owner = null
        slot.freedAt = ++clock
      },
    }
  }

  return {
    createTrack,
    wait: seconds => new Promise(resolve => { env.setTimeout(resolve, seconds * 1000) }),
    setMasterVolume(level) {
      masterLevel = level
      if (master) master.gain.value = level
    },
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
    idle() {
      if (context && isRunning(context)) void Promise.resolve(context.suspend()).catch(() => {})
    },
    addGestureListener(callback) {
      // The events that carry user activation: a mouse press, a touch or pen release, a key other than Escape.
      const types = ['pointerdown', 'pointerup', 'touchend', 'keydown']
      const handler = (event: Event) => {
        if (!activates(event)) return
        remove()
        callback()
      }
      const remove = () => types.forEach(type => env.document.removeEventListener(type, handler, true))
      types.forEach(type => env.document.addEventListener(type, handler, true))
      return remove
    },
  }
}

function activates(event: Event): boolean {
  if (event.type === 'keydown') return (event as KeyboardEvent).key !== 'Escape'
  if (event.type === 'touchend') return true
  const mouse = (event as PointerEvent).pointerType === 'mouse'
  return event.type === 'pointerdown' ? mouse : !mouse
}
