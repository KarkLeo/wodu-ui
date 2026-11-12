import type { Decorator } from '@storybook/vue3-vite'
import { emptyStage, withScene } from '@/domain/stage'
import { useMediaPrefsStore, type SoundPref } from '@/stores/mediaPrefs'
import { useStageStore } from '@/stores/stage'
import type { Scene } from '@/types/stage'
import { blockedMock, resetSceneAudioMock, sceneAudioCalls } from '../../.storybook/mocks/sceneAudioInstance'
import { crookhollow } from './fixtures'

export interface PrefsSeed {
  sound?: SoundPref
  volume?: number
  background?: boolean
  /** The audio service holds the sound back until a tap. */
  blocked?: boolean
}

/** This device's media choices and a clean audio mock. List it before the table decorator, so it runs after it. */
export function withMediaPrefs(seed: PrefsSeed = {}): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetSceneAudioMock()
      const prefs = useMediaPrefsStore()
      prefs.$patch({ sound: seed.sound ?? 'unset', volume: seed.volume ?? 0.6, background: seed.background ?? true })
      blockedMock.value = seed.blocked ?? false
    },
    template: '<story />',
  })
}

/** Crookhollow's table with a scene on (or with nothing on stage when `scene` is null). */
export function withLiveScene(scene: Scene | null): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const stages = useStageStore()
      stages.clearAll()
      if (scene) stages.set(withScene(emptyStage(crookhollow.id), scene))
    },
    template: '<story />',
  })
}

export function showScene(scene: Scene | null) {
  const stages = useStageStore()
  const stage = emptyStage(crookhollow.id)
  stages.set(scene ? withScene(stage, scene) : stage)
}

export const sceneCalls = () => sceneAudioCalls.filter(c => c.method === 'setScene')
export const sceneUrls = () => sceneCalls().flatMap(c => (c.method === 'setScene' && c.src !== null ? [c.src] : []))

export function sceneSoundUrl(scene: Scene): string {
  return `http://127.0.0.1:8090/api/files/scenes/${scene.id}/${scene.sound}`
}

/**
 * Decoding in a story: held until the story releases it, so it can show what the screen does meanwhile.
 * `auto` lets every picture decode at once. Call `restore` when done.
 */
export function controlDecode(auto = false) {
  const original = HTMLImageElement.prototype.decode
  const pending = new Map<string, { resolve: () => void; reject: () => void }[]>()
  HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
    if (auto) return Promise.resolve()
    const src = this.src
    return new Promise<void>((resolve, reject) => {
      const list = pending.get(src) ?? []
      list.push({ resolve, reject: () => reject(new DOMException('broken', 'EncodingError')) })
      pending.set(src, list)
    })
  }
  return {
    release(src: string) { pending.get(src)?.forEach(p => p.resolve()); pending.delete(src) },
    fail(src: string) { pending.get(src)?.forEach(p => p.reject()); pending.delete(src) },
    waiting: (src: string) => (pending.get(src)?.length ?? 0) > 0,
    restore() { HTMLImageElement.prototype.decode = original },
  }
}

/** A solid picture as a data URL, which decodes without a request. */
export function colourPicture(colour: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 20
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, 32, 20)
  return canvas.toDataURL('image/png')
}
