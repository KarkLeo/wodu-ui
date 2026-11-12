const WAIT_MS = 5000

/** The length in seconds the browser reads from a file's metadata; null when it cannot tell. */
export function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let url: string
    let audio: HTMLAudioElement
    try {
      url = URL.createObjectURL(file)
      audio = new Audio()
    } catch {
      resolve(null)
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = (value: number | null) => {
      clearTimeout(timer)
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(value)
    }
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null), { once: true })
    audio.addEventListener('error', () => done(null), { once: true })
    timer = setTimeout(() => done(null), WAIT_MS)
    audio.src = url
  })
}
