import type {
  FileRef, MediaCollection, Scene, Sound, Stage, StageImage, StageScene, StageSound, TableImage,
} from '@/types/stage'
import { cutText } from '@/utils/text'

export const MEDIA_LIMITS = { scenes: 20, sounds: 15, images: 30 } as const
export const IMAGE_MAX_BYTES = 2097152
export const AUDIO_MAX_BYTES = 20971520
export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const AUDIO_TYPES: readonly string[] = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
export const SCENE_NAME_MAX = 80
export const SOUND_NAME_MAX = 80
export const CAPTION_MAX = 120
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

/** What players render: trimmed, a blank one is none, and never longer than `CAPTION_MAX`. */
function stageCaption(raw: string | null): string | null {
  const text = raw === null ? '' : cutText(raw.trim(), CAPTION_MAX).trim()
  return text === '' ? null : text
}

export function withImage(stage: Stage, image: TableImage, withCaption: boolean, shownAt: string): Stage {
  return {
    ...stage,
    image: {
      id: image.id,
      file: { collection: 'images', record: image.id, name: image.file },
      caption: withCaption ? stageCaption(image.caption) : null,
      shownAt,
    },
  }
}

export function withoutImage(stage: Stage): Stage {
  return { ...stage, image: null }
}

/**
 * The stage after the master saved `image`. Only the shown image is touched: its file follows, `shownAt` stays (an edit is
 * not a new reveal), and a caption already on the table follows the edit. A stage caption of null stays null, so an edit
 * never puts text on the players' screens that the master did not choose to show.
 */
export function withImageEdited(stage: Stage, image: TableImage): Stage {
  const shown = stage.image
  if (!shown || shown.id !== image.id) return stage
  const caption = stageCaption(shown.caption) === null ? null : stageCaption(image.caption)
  if (shown.file.name === image.file && shown.caption === caption) return stage
  return {
    ...stage,
    image: { ...shown, file: { collection: 'images', record: image.id, name: image.file }, caption },
  }
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
  return { id: v.id, file, caption: typeof v.caption === 'string' ? stageCaption(v.caption) : null, shownAt: v.shownAt }
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

/**
 * A stored image's data. A caption over `CAPTION_MAX` is cut, as on the stage, not refused: dropping the row would make
 * the image invisible and undeletable while it still counts toward the limit. A person's draft is refused instead
 * (`checkImageDraft`).
 */
export function checkImageData(value: unknown): { id: string; caption: string | null } | null {
  if (!isRecord(value) || !nonEmpty(value.id)) return null
  const raw = value.caption
  if (raw !== undefined && raw !== null && typeof raw !== 'string') return null
  return { id: value.id, caption: stageCaption(typeof raw === 'string' ? raw : null) }
}

export function checkImageDraft(draft: { caption: string; hasFile: boolean }): Array<'captionTooLong' | 'noFile'> {
  const problems: Array<'captionTooLong' | 'noFile'> = []
  if (draft.caption.trim().length > CAPTION_MAX) problems.push('captionTooLong')
  if (!draft.hasFile) problems.push('noFile')
  return problems
}

/** Whether a client that finds this overlay in the stage should play it: always while looping, otherwise only if fresh. */
export function shouldPlayOverlay(sound: StageSound, now: Date): boolean {
  if (sound.loop) return true
  return now.getTime() - Date.parse(sound.startedAt) <= STALE_ONE_SHOT_SECONDS * 1000
}

/** After a one-shot ended on the master's device, how long its clear waits, so a device that started later ends too. */
export const ONE_SHOT_CLEAR_GRACE_SECONDS = 15
/** The least time the clock leaves after a one-shot's duration before it clears: durations can be under-reported. */
export const ONE_SHOT_CLEAR_MIN_TAIL_SECONDS = 30
export const ONE_SHOT_UNKNOWN_CLEAR_SECONDS = 3600

/**
 * Milliseconds until the master's client clears a one-shot overlay from the stage by the clock; null for no clock
 * clear. Clearing is bookkeeping and must never cut or swallow a sound a device still plays or is about to start
 * (a slow download, a slow write, an under-reported duration, a skewed clock), so it is late: with a known duration,
 * duration plus the larger of `ONE_SHOT_CLEAR_MIN_TAIL_SECONDS` and half of it. While this device plays it, that is
 * only a backstop to the end of the track (plus `ONE_SHOT_CLEAR_GRACE_SECONDS`), and an unknown duration has none;
 * otherwise an unknown duration waits an hour. 0 when overdue.
 */
export function oneShotClearDelay(sound: StageSound, duration: number | null, now: Date, playingHere = false): number | null {
  if (sound.loop) return null
  let seconds: number
  if (duration !== null) seconds = duration + Math.max(ONE_SHOT_CLEAR_MIN_TAIL_SECONDS, duration / 2)
  else if (playingHere) return null
  else seconds = ONE_SHOT_UNKNOWN_CLEAR_SECONDS
  const delay = Date.parse(sound.startedAt) + seconds * 1000 - now.getTime()
  return Number.isNaN(delay) ? 0 : Math.max(0, delay)
}

/**
 * Milliseconds until a one-shot this device does not play is over by the clock (its `startedAt` plus its duration),
 * for the master's row; null for a loop or an unknown duration, which are never over by time. 0 when over.
 */
export function oneShotOverDelay(sound: StageSound, duration: number | null, now: Date): number | null {
  if (sound.loop || duration === null) return null
  const delay = Date.parse(sound.startedAt) + duration * 1000 - now.getTime()
  return Number.isNaN(delay) ? 0 : Math.max(0, delay)
}

/** How the stage's sound slot reached this device: `live` (a realtime change or my own publish) or a load. */
export interface SlotArrival {
  source: 'live' | 'load'
  /** This device's clock (ms). */
  at: number
}

/**
 * The sound slot's arrival after a game's stage went from `previous` to `next`: it moves only when the slot's own key
 * changed (or there was none yet), so a scene or picture change never makes an old one-shot look fresh.
 */
export function nextSoundArrival(
  previous: Stage | undefined,
  next: Stage,
  arrival: SlotArrival | undefined,
  source: SlotArrival['source'],
  at: number,
): SlotArrival {
  const key = (stage: Stage | undefined) => (stage?.sound ? overlayKey(stage.sound) : null)
  if (arrival && previous && key(previous) === key(next)) return arrival
  return { source, at }
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function overlayKey(sound: StageSound): string {
  return `${sound.id}:${sound.startedAt}`
}

export function revealKey(image: StageImage): string {
  return `${image.id}:${image.shownAt}`
}

/**
 * Whether a picture should pop up for this device. `previous` is the key seen last (`undefined`: nothing seen yet since
 * the table opened, so what is found there never reveals); the master, who just showed it, is never revealed to.
 */
export function shouldReveal(previousKey: string | null | undefined, nextKey: string | null, isMaster: boolean): boolean {
  if (previousKey === undefined || nextKey === null || isMaster) return false
  return nextKey !== previousKey
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

/** What one open table's device knows about one overlay key; created when the key is first seen and never re-created. */
export interface OverlayRecord {
  /** How the value that first brought the key arrived: a realtime change or my own publish (`live`), or a load or reload. */
  source: 'live' | 'load'
  /** This device's clock (ms) at that first sight. */
  firstSeen: number
  loop: boolean
  /** `null` until a moment at which this device could play it (sound on); then fixed. */
  play: boolean | null
  /** It finished, or was replaced or stopped, here: a one-shot is never played again. */
  ended: boolean
  /** The track ran to its end on this device (the service reported it). */
  finished: boolean
}

/** Per open game; survives the stage's sound going to null, so a rollback, an echo or a snapshot never makes a key new. */
export type OverlayMemory = Readonly<Record<string, OverlayRecord>>

/**
 * The memory after the stage's overlay became `sound` (null: none, nothing changes). A key seen for the first time
 * gets its record from `arrival`; the decision to play is made once, at the first moment `canPlay` (sound on), from
 * the record's own source and first-seen time and never from later values: a loop always plays; a live one-shot
 * plays while it is at most `STALE_ONE_SHOT_SECONDS` since this device first saw it (its clock, not the master's);
 * a found one follows the `startedAt` rule.
 */
export function nextOverlayMemory(
  memory: OverlayMemory,
  sound: StageSound | null,
  arrival: { source: 'live' | 'load'; at: number },
  canPlay: boolean,
  now: number,
): OverlayMemory {
  if (!sound) return memory
  const key = overlayKey(sound)
  const record: OverlayRecord = memory[key] ?? { source: arrival.source, firstSeen: arrival.at, loop: sound.loop, play: null, ended: false, finished: false }
  let play = record.play
  if (play === null && canPlay) {
    if (record.loop) play = true
    else if (record.source === 'live') play = now - record.firstSeen <= STALE_ONE_SHOT_SECONDS * 1000
    else play = shouldPlayOverlay(sound, new Date(now))
  }
  if (memory[key] && play === record.play) return memory
  return { ...memory, [key]: { ...record, play } }
}

/** A one-shot that finished, or was replaced or stopped, here; a loop is never retired, it plays whenever it should sound. */
export function endOverlay(memory: OverlayMemory, key: string, byEnding = false): OverlayMemory {
  const record = memory[key]
  if (!record || (record.ended && (record.finished || !byEnding)) || (record.loop && !byEnding)) return memory
  return { ...memory, [key]: { ...record, ended: true, finished: record.finished || byEnding } }
}

/** Whether this device should have the stage's overlay sounding now. */
export function shouldPlayKey(memory: OverlayMemory, sound: StageSound | null): boolean {
  const record = sound ? memory[overlayKey(sound)] : undefined
  return record?.play === true && !record.ended
}

/** This device played the key and it ran to its end here: its clear comes from the end of the track. */
export function playedToTheEnd(memory: OverlayMemory, key: string): boolean {
  const record = memory[key]
  return record?.play === true && record.finished
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
  /** The single sound the master played, only while this device has sound on; the overlay memory decides whether it plays. */
  overlay: { key: string; src: string; loop: boolean } | null
}

/** What one device fetches and plays for a stage: what is off gets no URL, so nothing is downloaded. */
export function playbackTarget(stage: Stage | null, prefs: PlaybackPrefs, base: string): PlaybackTarget {
  if (!stage) return { sceneSound: null, backdrop: null, wantsSound: false, overlay: null }
  const sound = stage.scene?.sound ?? null
  const image = stage.scene?.image ?? null
  return {
    sceneSound: prefs.sound === 'on' && sound ? fileUrl(base, sound) : null,
    backdrop: prefs.background && image ? fileUrl(base, image) : null,
    wantsSound: sound !== null || stage.sound !== null,
    overlay: stage.sound && prefs.sound === 'on'
      ? { key: overlayKey(stage.sound), src: fileUrl(base, stage.sound.file), loop: stage.sound.loop }
      : null,
  }
}
