import { mediaThumb } from '@/transport/media'
import type { TableImage } from '@/types/stage'

// The one size the `images` collection configures; any other makes the server send the original file.
const THUMB_SIZE = '320x0'

/** Where the server serves the image at the size of a grid tile (a width of 320, the height following). */
export function imageThumbUrl(image: TableImage): string {
  return mediaThumb({ collection: 'images', record: image.id, name: image.file }, THUMB_SIZE)
}
