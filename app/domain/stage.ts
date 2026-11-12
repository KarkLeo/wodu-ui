import type {
  FileRef, MediaCollection, Scene, Sound, Stage, StageImage, StageScene, StageSound,
} from '@/types/stage'

export const MEDIA_LIMITS = { scenes: 20, sounds: 15, images: 30 } as const
export const IMAGE_MAX_BYTES = 2097152
export const AUDIO_MAX_BYTES = 20971520
export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const AUDIO_TYPES: readonly string[] = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
export const SCENE_NAME_MAX = 80
export const SOUND_NAME_MAX = 80
export const STALE_ONE_SHOT_SECONDS = 5

export type FileKind = 'image' | 'audio'

const COLLECTIONS: readonly string[] = ['scenes', 'sounds', 'images']

const EXTENSIONS: Record<FileKind, Record<string, string>> = {
  image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  audio: { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac' },
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

export function emptyStage(gameId: string): Stage {
  return { id: gameId, scene: null, image: null, sound: null }
}

function sceneRef(scene: Scene, name: string | null): FileRef | null {
  return name ? { collection: 'scenes', record: scene.id, name } : null
}

export function withScene(stage: Stage, scene: Scene): Stage {
  return {
    ...stage,
    scene: { id: scene.id, image: sceneRef(scene, scene.image), sound: sceneRef(scene, scene.sound) },
  }
}

export function withoutScene(stage: Stage): Stage {
  return { ...stage, scene: null }
}

export function withSound(stage: Stage, sound: Sound, startedAt: string): Stage {
  return {
    ...stage,
    sound: {
      id: sound.id,
      file: { collection: 'sounds', record: sound.id, name: sound.file },
      loop: sound.loop,
      startedAt,
    },
  }
}

export function withoutSound(stage: Stage): Stage {
  return { ...stage, sound: null }
}

// A record id as PocketBase accepts it from this client, and a stored file name that cannot change the path
// or the query of the address it is put into.
const RECORD_ID = /^[a-zA-Z0-9_-]{15,36}$/
const UNSAFE_NAME = /[/\\?#]|\.\./

function checkFileRef(v: unknown): FileRef | null {
  if (!isRecord(v)) return null
  if (typeof v.collection !== 'string' || !COLLECTIONS.includes(v.collection)) return null
  if (typeof v.record !== 'string' || !RECORD_ID.test(v.record)) return null
  if (!nonEmpty(v.name) || UNSAFE_NAME.test(v.name)) return null
  return { collection: v.collection as MediaCollection, record: v.record, name: v.name }
}

function checkOptionalRef(v: unknown): { ok: boolean; ref: FileRef | null } {
  if (v === null || v === undefined) return { ok: true, ref: null }
  const ref = checkFileRef(v)
  return { ok: ref !== null, ref }
}

function checkStageScene(v: unknown): StageScene | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const image = checkOptionalRef(v.image)
  const sound = checkOptionalRef(v.sound)
  if (!image.ok || !sound.ok) return null
  return { id: v.id, image: image.ref, sound: sound.ref }
}

function checkStageImage(v: unknown): StageImage | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const file = checkFileRef(v.file)
  if (!file || !nonEmpty(v.shownAt)) return null
  if (v.caption !== null && v.caption !== undefined && typeof v.caption !== 'string') return null
  return { id: v.id, file, caption: typeof v.caption === 'string' ? v.caption : null, shownAt: v.shownAt }
}

function checkStageSound(v: unknown): StageSound | null {
  if (!isRecord(v) || !nonEmpty(v.id)) return null
  const file = checkFileRef(v.file)
  if (!file || typeof v.loop !== 'boolean' || !nonEmpty(v.startedAt)) return null
  return { id: v.id, file, loop: v.loop, startedAt: v.startedAt }
}

export function checkStage(value: unknown, gameId: string): Stage | null {
  if (!isRecord(value) || value.id !== gameId) return null
  return {
    id: gameId,
    scene: checkStageScene(value.scene),
    image: checkStageImage(value.image),
    sound: checkStageSound(value.sound),
  }
}

export function checkSceneData(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  const id = value.id.trim()
  const name = value.name.trim()
  if (!id || !name || name.length > SCENE_NAME_MAX) return null
  return { id, name }
}

export function checkSceneDraft(
  draft: { name: string; hasImage: boolean; hasSound: boolean },
): Array<'nameRequired' | 'nameTooLong' | 'noFiles'> {
  const problems: Array<'nameRequired' | 'nameTooLong' | 'noFiles'> = []
  const name = draft.name.trim()
  if (!name) problems.push('nameRequired')
  else if (name.length > SCENE_NAME_MAX) problems.push('nameTooLong')
  if (!draft.hasImage && !draft.hasSound) problems.push('noFiles')
  return problems
}

export function checkSoundData(
  value: unknown,
): { id: string; name: string; loop: boolean; duration: number | null } | null {
  if (!isRecord(value) || !nonEmpty(value.id) || typeof value.name !== 'string') return null
  const name = value.name.trim()
  if (!name || name.length > SOUND_NAME_MAX || typeof value.loop !== 'boolean') return null
  const raw = value.duration
  if (raw !== undefined && raw !== null && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0)) return null
  return { id: value.id, name, loop: value.loop, duration: typeof raw === 'number' ? raw : null }
}

export function checkSoundDraft(draft: { name: string; hasFile: boolean }): Array<'nameRequired' | 'nameTooLong' | 'noFile'> {
  const problems: Array<'nameRequired' | 'nameTooLong' | 'noFile'> = []
  const name = draft.name.trim()
  if (!name) problems.push('nameRequired')
  else if (name.length > SOUND_NAME_MAX) problems.push('nameTooLong')
  if (!draft.hasFile) problems.push('noFile')
  return problems
}

/** Whether a client that finds this overlay in the stage should play it: always while looping, otherwise only if fresh. */
export function shouldPlayOverlay(sound: StageSound, receivedLive: boolean, now: Date): boolean {
  if (sound.loop || receivedLive) return true
  return now.getTime() - Date.parse(sound.startedAt) <= STALE_ONE_SHOT_SECONDS * 1000
}

/** Milliseconds until the master's client clears a one-shot overlay from the stage; null for a loop. */
export function oneShotClearDelay(sound: StageSound, duration: number | null, now: Date): number | null {
  if (sound.loop) return null
  const seconds = duration === null ? STALE_ONE_SHOT_SECONDS : duration
  const delay = Date.parse(sound.startedAt) + seconds * 1000 - now.getTime()
  return Number.isNaN(delay) ? 0 : Math.max(0, delay)
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function overlayKey(sound: StageSound): string {
  return `${sound.id}:${sound.startedAt}`
}

export function checkUpload(kind: FileKind, file: { type: string; size: number }): 'ok' | 'type' | 'size' {
  const types = kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES
  if (!types.includes(file.type)) return 'type'
  const max = kind === 'image' ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES
  return file.size > max ? 'size' : 'ok'
}

export function neutralFileName(kind: FileKind, type: string): string {
  const ext = Object.prototype.hasOwnProperty.call(EXTENSIONS[kind], type) ? EXTENSIONS[kind][type] : undefined
  if (!ext) throw new Error(`Unsupported ${kind} type: ${type}`)
  return `${kind === 'image' ? 'image' : 'sound'}.${ext}`
}

export function fileUrl(base: string, ref: FileRef, thumb?: string): string {
  const root = base.replace(/\/+$/, '')
  const url = `${root}/api/files/${ref.collection}/${encodeURIComponent(ref.record)}/${encodeURIComponent(ref.name)}`
  return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url
}

export interface PlaybackPrefs {
  sound: 'unset' | 'on' | 'off'
  background: boolean
}

export interface PlaybackTarget {
  /** The scene sound's URL, only while this device has sound on. */
  sceneSound: string | null
  /** The scene picture's URL, only while this device shows scene backgrounds. */
  backdrop: string | null
  /** The stage carries a sound, whatever this device's choice: it decides whether to ask. */
  wantsSound: boolean
  /** The single sound the master played, only while this device has sound on and it is worth playing. */
  overlay: { key: string; src: string; loop: boolean } | null
}

/** What one device fetches and plays for a stage: what is off gets no URL, so nothing is downloaded. */
export function playbackTarget(
  stage: Stage | null,
  prefs: PlaybackPrefs,
  base: string,
  arrival: { receivedLive: boolean; now: Date } = { receivedLive: true, now: new Date() },
): PlaybackTarget {
  if (!stage) return { sceneSound: null, backdrop: null, wantsSound: false, overlay: null }
  const sound = stage.scene?.sound ?? null
  const image = stage.scene?.image ?? null
  return {
    sceneSound: prefs.sound === 'on' && sound ? fileUrl(base, sound) : null,
    backdrop: prefs.background && image ? fileUrl(base, image) : null,
    wantsSound: sound !== null || stage.sound !== null,
    overlay: stage.sound && prefs.sound === 'on' && shouldPlayOverlay(stage.sound, arrival.receivedLive, arrival.now)
      ? { key: overlayKey(stage.sound), src: fileUrl(base, stage.sound.file), loop: stage.sound.loop }
      : null,
  }
}
