import type { SceneAudioDeps, Track } from './SceneAudio'

export const READY_FALLBACK_SECONDS = 6
export const RESUME_GRACE_MS = 250

// Gain nodes, not element.volume: iOS ignores the latter.
const isRunning = (context: AudioContext) => context.state === 'running'

// Without a user gesture some browsers leave resume() pending forever, so never wait on it open-endedly.
async function resumeBounded(context: AudioContext): Promise<boolean> {
  if (isRunning(context)) return true
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const attempt = Promise.resolve(context.resume()).catch(() => {})
    await Promise.race([attempt, new Promise<void>(resolve => { timer = setTimeout(resolve, RESUME_GRACE_MS) })])
  } catch { /* resume() threw synchronously */ }
  clearTimeout(timer)
  return isRunning(context)
}

export function webAudioDeps(): SceneAudioDeps {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let masterLevel = 1

  function graph() {
    if (!context || !master) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = masterLevel
      master.connect(context.destination)
    }
    return { context, master }
  }

  function createTrack(src: string, loop: boolean): Track {
    const { context, master } = graph()
    const element = new Audio()
    element.crossOrigin = 'anonymous'
    element.preload = 'auto'
    element.loop = loop
    const gain = context.createGain()
    gain.gain.value = 0
    context.createMediaElementSource(element).connect(gain)
    gain.connect(master)

    let timer: ReturnType<typeof setTimeout> | undefined
    const ready = new Promise<void>((resolve, reject) => {
      // iPhones ignore preload and may never fire canplaythrough before play().
      timer = setTimeout(resolve, READY_FALLBACK_SECONDS * 1000)
      element.addEventListener('canplaythrough', () => { clearTimeout(timer); resolve() }, { once: true })
      element.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Cannot load ${src}`)) }, { once: true })
    })
    ready.catch(() => {})
    element.src = src
    element.load()

    return {
      ready,
      async play() {
        if (!await resumeBounded(context)) throw new DOMException('Audio context is suspended', 'NotAllowedError')
        await element.play()
      },
      pause: () => element.pause(),
      fadeTo(level, seconds) {
        const now = context.currentTime
        const from = gain.gain.value
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(from, now)
        gain.gain.linearRampToValueAtTime(level, now + seconds)
      },
      dispose() {
        clearTimeout(timer)
        element.pause()
        element.removeAttribute('src')
        element.load()
        gain.disconnect()
      },
    }
  }

  return {
    createTrack,
    wait: seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000)),
    setMasterVolume(level) {
      masterLevel = level
      if (master) master.gain.value = level
    },
    async unlock() {
      const { context } = graph()
      return resumeBounded(context)
    },
  }
}
