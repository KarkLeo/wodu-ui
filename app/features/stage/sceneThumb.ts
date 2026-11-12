import { mediaThumb } from '@/transport/media'
import type { Scene } from '@/types/stage'

const THUMB_SIZE = '176x112'

/** Where the server serves the scene's picture at the size of a list thumbnail; null when it has none. */
export function sceneThumbUrl(scene: Scene): string | null {
  return scene.image ? mediaThumb({ collection: 'scenes', record: scene.id, name: scene.image }, THUMB_SIZE) : null
}
