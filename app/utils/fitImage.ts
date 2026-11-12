import { IMAGE_TYPES, neutralFileName } from '@/domain/stage'

/** `decode`: the browser cannot read the file; `encode`: it cannot write WebP or JPEG; `size`: nothing small enough came out. */
export class ImageFitError extends Error {
  constructor(public kind: 'decode' | 'encode' | 'size') {
    super(`cannot fit the image: ${kind}`)
    this.name = 'ImageFitError'
  }
}

const QUALITIES = [0.9, 0.75, 0.6]
const MAX_HALVINGS = 8

type Format = 'image/webp' | 'image/jpeg'

// Where a canvas cannot write WebP (WebKit hands back a PNG), the export falls back to JPEG, which has no
// transparency: it is flattened onto the page's darkest token, so a transparent picture does not turn black.
function backdrop(): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--vtt-bg-sunken').trim()
  return value || null
}

function encode(bitmap: ImageBitmap, width: number, height: number, format: Format, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const fill = format === 'image/jpeg' ? backdrop() : null
  if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise(resolve => canvas.toBlob(resolve, format, quality))
}

/**
 * Returns the file unchanged when it is an accepted type within the limit; otherwise re-encodes it to WebP
 * (JPEG where the browser cannot write WebP), lowering quality and then size (halving both sides) until it
 * fits. Rejects with an `ImageFitError`.
 */
export async function fitImage(file: File, maxBytes: number): Promise<File> {
  if (IMAGE_TYPES.includes(file.type) && file.size <= maxBytes) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageFitError('decode')
  }
  try {
    let format: Format = 'image/webp'
    let width = bitmap.width
    let height = bitmap.height
    for (let step = 0; step <= MAX_HALVINGS; step++) {
      for (const quality of QUALITIES) {
        let blob = await encode(bitmap, width, height, format, quality)
        if (blob && format === 'image/webp' && blob.type !== 'image/webp') {
          format = 'image/jpeg'
          blob = await encode(bitmap, width, height, format, quality)
        }
        if (!blob || blob.type !== format) throw new ImageFitError('encode')
        if (blob.size <= maxBytes) {
          return new File([blob], neutralFileName('image', format), { type: format })
        }
      }
      width = Math.max(1, Math.round(width / 2))
      height = Math.max(1, Math.round(height / 2))
    }
    throw new ImageFitError('size')
  } finally {
    bitmap.close()
  }
}
