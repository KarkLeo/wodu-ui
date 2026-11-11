import type { Decorator } from '@storybook/vue3-vite'
import { emptyStage, withScene } from '@/domain/stage'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import type { Scene } from '@/types/stage'
import { clearPbRequests, resetRecords } from '../../.storybook/mocks/pb'
import { clearSentForms, failUploadsWith } from '../../.storybook/mocks/upload'
import { crookhollow } from './fixtures'

export const SCENES: Scene[] = [
  { id: 'story-scene-tavern', name: 'Tavern', image: 'image.jpg', sound: 'sound.mp3' },
  { id: 'story-scene-forest', name: 'Night forest', image: 'image.png', sound: null },
  { id: 'story-scene-rain', name: 'Rain', image: null, sound: 'sound.mp3' },
]

export const TAVERN = SCENES[0]!

/** The scene as the server would store it for Crookhollow. */
export function sceneRow(scene: Scene, game: string = crookhollow.id) {
  return { id: scene.id, game, data: { id: scene.id, name: scene.name }, image: scene.image ?? '', sound: scene.sound ?? '' }
}

export function manyScenes(count: number): Scene[] {
  return Array.from({ length: count }, (_, i) => ({ id: `story-scene-${i + 1}`, name: `Scene ${i + 1}`, image: 'image.png', sound: null }))
}

export interface ScenesSeed {
  scenes?: Scene[]
  /** `idle` leaves the store untouched after clearing it, for stories that run the media session themselves. */
  status?: 'ready' | 'loading' | 'failed' | 'idle'
  /** Id of the scene shown at the table. */
  live?: string | null
}

/**
 * Crookhollow's scenes as the master's client holds them: in the media store and in the mock server, with
 * nothing sent so far. List it before the table decorator, so it runs after it.
 */
export function withScenes(seed: ScenesSeed = {}): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const list = seed.scenes ?? SCENES
      const status = seed.status ?? 'ready'
      resetRecords('scenes', list.map(s => sceneRow(s)))
      resetRecords('stages')
      clearPbRequests()
      clearSentForms()
      failUploadsWith(null)
      const media = useMediaStore()
      media.clearAll()
      if (status !== 'idle') {
        media.startLoading(crookhollow.id)
        if (status === 'ready') media.setScenes(crookhollow.id, structuredClone(list))
        if (status === 'failed') media.setFailed(crookhollow.id)
      }
      const stages = useStageStore()
      stages.clearAll()
      const live = list.find(s => s.id === seed.live)
      if (live) stages.set(withScene(emptyStage(crookhollow.id), live))
      useToastsStore().clearAll()
    },
    template: '<story />',
  })
}

export function pictureFile(name = 'tavern.png', type = 'image/png', size = 2048): File {
  return new File([new Uint8Array(size)], name, { type })
}

export function soundFile(name = 'rain.mp3', type = 'audio/mpeg', size = 4096): File {
  return new File([new Uint8Array(size)], name, { type })
}

/** A PNG of random pixels, which PNG cannot shrink: over 2 MB at this size. */
export async function noisePng(name = 'huge-map.png', width = 900, height = 800): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const pixels = ctx.createImageData(width, height)
  // getRandomValues takes at most 65536 bytes at a time.
  for (let i = 0; i < pixels.data.length; i += 65536) crypto.getRandomValues(pixels.data.subarray(i, i + 65536))
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = 255
  ctx.putImageData(pixels, 0, 0)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('the canvas could not write a PNG')
  return new File([blob], name, { type: 'image/png' })
}
