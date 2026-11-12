// Stories never touch real Web Audio: the service records what it is asked, a story sets `blocked` and can end the overlay.
import { readonly, ref } from 'vue'
import type { OverlayRequest, SceneAudio } from '@/services/SceneAudio'

export const blockedMock = ref(false)

export type SceneAudioCall =
  | { method: 'setScene'; src: string | null }
  | { method: 'setOverlay'; overlay: OverlayRequest | null }
  | { method: 'setVolume'; level: number }
  | { method: 'unlock' }
  | { method: 'arm' }
  | { method: 'stop' }

export const sceneAudioCalls: SceneAudioCall[] = []

const overlayEndedListeners: Array<(key: string) => void> = []

/** What the real service reports when a non-looping overlay finishes by itself. */
export function fireOverlayEnded(key: string): void {
  for (const listener of [...overlayEndedListeners]) listener(key)
}

/** Keeps the overlay-ended listeners: a subscriber made before the reset stays, and each one unsubscribes itself. */
export function resetSceneAudioMock(): void {
  sceneAudioCalls.length = 0
  blockedMock.value = false
}

const mock: SceneAudio = {
  blocked: readonly(blockedMock),
  setVolume(level) { sceneAudioCalls.push({ method: 'setVolume', level }) },
  setScene(src) { sceneAudioCalls.push({ method: 'setScene', src }) },
  setOverlay(overlay) { sceneAudioCalls.push({ method: 'setOverlay', overlay: overlay && { ...overlay } }) },
  onOverlayEnded(listener) {
    overlayEndedListeners.push(listener)
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      const i = overlayEndedListeners.indexOf(listener)
      if (i >= 0) overlayEndedListeners.splice(i, 1)
    }
  },
  async unlock() {
    sceneAudioCalls.push({ method: 'unlock' })
    blockedMock.value = false
  },
  arm() { sceneAudioCalls.push({ method: 'arm' }) },
  stop() { sceneAudioCalls.push({ method: 'stop' }) },
}

export function sceneAudio(): SceneAudio {
  return mock
}
