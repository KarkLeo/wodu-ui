import type { SceneAudioDeps, Track } from './SceneAudio'

export const READY_FALLBACK_SECONDS = 6

// Gain nodes, not element.volume: iOS ignores the latter.
const isRunning = (context: AudioContext) => context.state === 'running'

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

    const ready = new Promise<void>((resolve, reject) => {
      // iPhones ignore preload and may never fire canplaythrough before play().
      const timer = setTimeout(resolve, READY_FALLBACK_SECONDS * 1000)
      element.addEventListener('canplaythrough', () => { clearTimeout(timer); resolve() }, { once: true })
      element.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Cannot load ${src}`)) }, { once: true })
    })
    ready.catch(() => {})
    element.src = src
    element.load()

    return {
      ready,
      async play() {
        if (!isRunning(context)) {
          try { await context.resume() } catch { /* handled below */ }
          if (!isRunning(context)) throw new DOMException('Audio context is suspended', 'NotAllowedError')
        }
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
      try {
        if (context.state !== 'running') await context.resume()
      } catch {
        return false
      }
      return context.state === 'running'
    },
  }
}
