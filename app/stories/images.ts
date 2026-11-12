import type { Decorator } from '@storybook/vue3-vite'
import { emptyStage, withImage } from '@/domain/stage'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import type { TableImage } from '@/types/stage'
import { clearPbRequests, resetRecords } from '../../.storybook/mocks/pb'
import { clearSentForms, failUploadsWith } from '../../.storybook/mocks/upload'
import { crookhollow } from './fixtures'

export const IMAGES: TableImage[] = [
  { id: 'story-image-bridge', caption: 'The old bridge at dusk', file: 'image.jpg' },
  { id: 'story-image-map', caption: null, file: 'image.png' },
  { id: 'story-image-ogre', caption: 'Brakk the ogre, scarred and sullen', file: 'image.webp' },
]

export const BRIDGE = IMAGES[0]!
export const MAP = IMAGES[1]!
export const OGRE = IMAGES[2]!

/** The image as the server would store it for Crookhollow. */
export function imageRow(image: TableImage, game: string = crookhollow.id) {
  return { id: image.id, game, data: { id: image.id, caption: image.caption }, file: image.file }
}

export function manyImages(count: number): TableImage[] {
  return Array.from({ length: count }, (_, i) => ({ id: `story-image-${i + 1}`, caption: `Image ${i + 1}`, file: 'image.png' }))
}

export interface ImagesSeed {
  images?: TableImage[]
  /** `idle` leaves the store untouched after clearing it, for stories that run the media session themselves. */
  status?: 'ready' | 'loading' | 'failed' | 'idle'
  /** Id of the image shown at the table, with its caption unless `withoutCaption`. */
  shown?: string | null
  withoutCaption?: boolean
}

/**
 * Crookhollow's images as the master's client holds them: in the media store and in the mock server, with
 * nothing sent so far. List it before the table decorator, so it runs after it.
 */
export function withImages(seed: ImagesSeed = {}): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const list = seed.images ?? IMAGES
      const status = seed.status ?? 'ready'
      resetRecords('images', list.map(i => imageRow(i)))
      resetRecords('stages')
      clearPbRequests()
      clearSentForms()
      failUploadsWith(null)
      const media = useMediaStore()
      media.clearAll()
      if (status !== 'idle') {
        media.startLoading(crookhollow.id, ['images'])
        if (status === 'ready') media.setList('images', crookhollow.id, structuredClone(list))
        if (status === 'failed') media.setFailed('images', crookhollow.id)
      }
      const stages = useStageStore()
      stages.clearAll()
      const shown = list.find(i => i.id === seed.shown)
      if (shown) stages.set(withImage(emptyStage(crookhollow.id), shown, !seed.withoutCaption, new Date().toISOString()))
      useToastsStore().clearAll()
    },
    template: '<story />',
  })
}

/** Records the address of every `<img>` set while it is on (the stories have no server for files). Call `restore` when done. */
export function recordImageSources(): { urls: string[]; restore(): void } {
  const proto = HTMLImageElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'src')!
  const urls: string[] = []
  Object.defineProperty(proto, 'src', {
    ...original,
    set(this: HTMLImageElement, value: string) {
      urls.push(String(value))
      original.set!.call(this, value)
    },
  })
  return { urls, restore() { Object.defineProperty(proto, 'src', original) } }
}
