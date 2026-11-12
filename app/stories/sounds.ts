import type { Decorator } from '@storybook/vue3-vite'
import { emptyStage, withSound } from '@/domain/stage'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import type { Sound } from '@/types/stage'
import { clearPbRequests, resetRecords } from '../../.storybook/mocks/pb'
import { clearSentForms, failUploadsWith } from '../../.storybook/mocks/upload'
import { crookhollow } from './fixtures'

export const SOUNDS: Sound[] = [
  { id: 'story-sound-hearth', name: 'Hum and hearth', loop: true, duration: 252, file: 'sound.mp3' },
  { id: 'story-sound-brawl', name: 'Tavern brawl', loop: false, duration: 160, file: 'sound.mp3' },
  { id: 'story-sound-roar', name: 'Ogre roar', loop: false, duration: 6, file: 'sound.mp3' },
]

export const HEARTH = SOUNDS[0]!
export const BRAWL = SOUNDS[1]!

/** The sound as the server would store it for Crookhollow. */
export function soundRow(sound: Sound, game: string = crookhollow.id) {
  const data: Record<string, unknown> = { id: sound.id, name: sound.name, loop: sound.loop }
  if (sound.duration !== null) data.duration = sound.duration
  return { id: sound.id, game, data, file: sound.file }
}

export function manySounds(count: number): Sound[] {
  return Array.from({ length: count }, (_, i) => ({ id: `story-sound-${i + 1}`, name: `Sound ${i + 1}`, loop: false, duration: 30 + i, file: 'sound.mp3' }))
}

export interface SoundsSeed {
  sounds?: Sound[]
  /** `idle` leaves the store untouched after clearing it, for stories that run the media session themselves. */
  status?: 'ready' | 'loading' | 'failed' | 'idle'
  /** Id of the sound playing at the table. */
  playing?: string | null
}

/**
 * Crookhollow's sounds as the master's client holds them: in the media store and in the mock server, with
 * nothing sent so far. List it before the table decorator, so it runs after it.
 */
export function withSounds(seed: SoundsSeed = {}): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const list = seed.sounds ?? SOUNDS
      const status = seed.status ?? 'ready'
      resetRecords('sounds', list.map(s => soundRow(s)))
      resetRecords('stages')
      clearPbRequests()
      clearSentForms()
      failUploadsWith(null)
      const media = useMediaStore()
      media.clearAll()
      if (status !== 'idle') {
        media.startLoading(crookhollow.id, ['sounds'])
        if (status === 'ready') media.setList('sounds', crookhollow.id, structuredClone(list))
        if (status === 'failed') media.setFailed('sounds', crookhollow.id)
      }
      const stages = useStageStore()
      stages.clearAll()
      const playing = list.find(s => s.id === seed.playing)
      if (playing) stages.set(withSound(emptyStage(crookhollow.id), playing, new Date().toISOString()))
      useToastsStore().clearAll()
    },
    template: '<story />',
  })
}

/** A file that claims to be an MP3 and holds `seconds` of silence the browser can read the length of (a WAV, sniffed by content). */
export function playableFile(name = 'rain.mp3', seconds = 2): File {
  const rate = 8000
  const samples = rate * seconds
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i) }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(128, 44)
  return new File([bytes], name, { type: 'audio/mpeg' })
}
