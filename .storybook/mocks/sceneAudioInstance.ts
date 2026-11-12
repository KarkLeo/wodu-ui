// Stories never touch real Web Audio: the service records what it is asked, and a story sets `blocked`.
import { readonly, ref } from 'vue'
import type { SceneAudio } from '@/services/SceneAudio'

export const blockedMock = ref(false)

export type SceneAudioCall =
  | { method: 'setScene'; src: string | null }
  | { method: 'setVolume'; level: number }
  | { method: 'unlock' }
  | { method: 'stop' }

export const sceneAudioCalls: SceneAudioCall[] = []

export function resetSceneAudioMock(): void {
  sceneAudioCalls.length = 0
  blockedMock.value = false
}

const mock: SceneAudio = {
  blocked: readonly(blockedMock),
  setVolume(level) { sceneAudioCalls.push({ method: 'setVolume', level }) },
  setScene(src) { sceneAudioCalls.push({ method: 'setScene', src }) },
  async unlock() {
    sceneAudioCalls.push({ method: 'unlock' })
    blockedMock.value = false
  },
  stop() { sceneAudioCalls.push({ method: 'stop' }) },
}

export function sceneAudio(): SceneAudio {
  return mock
}
