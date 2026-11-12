import { mediaThumb } from '@/transport/media'
import type { TableImage } from '@/types/stage'

/** Where the server serves the image at the size of a grid tile (a width of 320, the height following). */
export function imageThumbUrl(image: TableImage, size = '320x0'): string {
  return mediaThumb({ collection: 'images', record: image.id, name: image.file }, size)
}
