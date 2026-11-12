// Stories never touch real Web Audio: the service records what it is asked, a story sets `blocked` and can end the overlay.
import { readonly, ref } from 'vue'
import type { OverlayRequest, SceneAudio } from '@/services/SceneAudio'

export const blockedMock = ref(false)

export type SceneAudioCall =
  | { method: 'setScene'; src: string | null }
  | { method: 'setOverlay'; overlay: OverlayRequest | null }
  | { method: 'setVolume'; level: number }
  | { method: 'unlock' }
  | { method: 'stop' }

export const sceneAudioCalls: SceneAudioCall[] = []

const overlayEndedListeners = new Set<(key: string) => void>()

/** What the real service reports when a non-looping overlay finishes by itself. */
export function fireOverlayEnded(key: string): void {
  overlayEndedListeners.forEach(listener => listener(key))
}

/** Also drops the overlay-ended listeners: the story's components subscribe after the decorators reset. */
export function resetSceneAudioMock(): void {
  sceneAudioCalls.length = 0
  blockedMock.value = false
  overlayEndedListeners.clear()
}

const mock: SceneAudio = {
  blocked: readonly(blockedMock),
  setVolume(level) { sceneAudioCalls.push({ method: 'setVolume', level }) },
  setScene(src) { sceneAudioCalls.push({ method: 'setScene', src }) },
  setOverlay(overlay) { sceneAudioCalls.push({ method: 'setOverlay', overlay: overlay && { ...overlay } }) },
  onOverlayEnded(listener) {
    overlayEndedListeners.add(listener)
    return () => { overlayEndedListeners.delete(listener) }
  },
  async unlock() {
    sceneAudioCalls.push({ method: 'unlock' })
    blockedMock.value = false
  },
  stop() { sceneAudioCalls.push({ method: 'stop' }) },
}

export function sceneAudio(): SceneAudio {
  return mock
}
