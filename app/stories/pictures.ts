/** A generated picture as a data URL, so a story has a real image of a known natural size without any server. */
export function drawPicture(width: number, height: number, label = `${width}x${height}`): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const fill = ctx.createLinearGradient(0, 0, width, height)
  fill.addColorStop(0, 'saddlebrown')
  fill.addColorStop(1, 'slategray')
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'wheat'
  ctx.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 40))
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(width, height)
  ctx.moveTo(width, 0)
  ctx.lineTo(0, height)
  ctx.stroke()
  ctx.fillStyle = 'wheat'
  ctx.font = `${Math.max(8, Math.round(Math.min(width, height) / 8))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, height / 2)
  return canvas.toDataURL('image/png')
}

export const PORTRAIT = { width: 600, height: 900 }
export const WIDE_MAP = { width: 1600, height: 500 }
export const TINY_ICON = { width: 48, height: 48 }

export const LONG_CAPTION = 'The abandoned watchtower above Crookhollow at dusk, one lantern burning in its top window, fog rising off the marsh road'

/**
 * Stories have no server for files: while it is on, an `<img>` whose address is an image file of the stage
 * (`/api/files/images/<id>/…`) gets the generated picture listed for that id instead. Returns the restore.
 */
export function servePictures(pictures: Record<string, string>): () => void {
  const proto = HTMLImageElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'src')!
  Object.defineProperty(proto, 'src', {
    ...original,
    set(this: HTMLImageElement, value: string) {
      const id = /\/api\/files\/images\/([^/?]+)\//.exec(String(value))?.[1]
      const own = id ? pictures[decodeURIComponent(id)] : undefined
      original.set!.call(this, own ?? value)
    },
  })
  return () => { Object.defineProperty(proto, 'src', original) }
}

/** Holds every `<img>` from loading until `release()`, to show what a screen does while a picture is on its way. Call `restore` when done. */
export function holdImages(): { release(): void; restore(): void } {
  const proto = HTMLImageElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'src')!
  let holding = true
  const held: [HTMLImageElement, string][] = []
  Object.defineProperty(proto, 'src', {
    ...original,
    set(this: HTMLImageElement, value: string) {
      if (holding) held.push([this, value])
      else original.set!.call(this, value)
    },
  })
  return {
    release() {
      holding = false
      for (const [img, value] of held.splice(0)) original.set!.call(img, value)
    },
    restore() { Object.defineProperty(proto, 'src', original) },
  }
}
