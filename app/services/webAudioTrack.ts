import type { SceneAudioDeps, Track } from './SceneAudio'

// Gain nodes, not element.volume: iOS ignores the latter.
export function webAudioDeps(): SceneAudioDeps {
  let context: AudioContext | null = null
  let master: GainNode | null = null

  function graph() {
    if (!context || !master) {
      context = new AudioContext()
      master = context.createGain()
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
      element.addEventListener('canplaythrough', () => resolve(), { once: true })
      element.addEventListener('error', () => reject(new Error(`Cannot load ${src}`)), { once: true })
    })
    ready.catch(() => {})
    element.src = src
    element.load()

    return {
      ready,
      play: () => element.play(),
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
      graph().master.gain.value = level
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
