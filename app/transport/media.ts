import { ClientResponseError } from 'pocketbase'
import { pb, type GameRow, type MediaRow } from '@/transport/pb'
import { guard } from './backend'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { publishStage, WriteDropped } from './stage'
import { toGame } from './games'
import { sendForm } from '@/transport/upload'
import {
  IMAGE_MAX_BYTES, MEDIA_LIMITS, checkImageData, checkImageDraft, checkSceneData, checkSceneDraft, checkSoundData, checkSoundDraft,
  checkUpload, fileUrl, neutralFileName, withImageEdited, withScene, withSound, withoutImage, withoutScene, withoutSound,
} from '@/domain/stage'
import { useGamesStore } from '@/stores/games'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import type { FileRef, MediaEntries, MediaKind, Scene, Sound, Stage, TableImage } from '@/types/stage'
import { fitImage } from '@/utils/fitImage'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:media')

/** A file for each of a kind's file fields: a `File` replaces, `null` removes, `undefined` keeps. */
export type MediaFiles = Record<string, File | null | undefined>

/** A file for each of the scene's two slots. */
export type SceneFiles = { image?: File | null; sound?: File | null }

/** What the form sends for a kind: the id and the kind's own fields. */
export type MediaDraft = { id: string; [field: string]: unknown }

export type MediaWriteKind = 'limitReached' | 'limitMayHaveChanged' | 'fileRefused' | 'notMaster' | 'stagePublishFailed' | 'aborted'

/** A file the server refused: which field, and whether for its type or its size. */
export interface FileRefusal { field: string; reason: 'type' | 'size' }

/**
 * The failures the form words differently; any other failure is thrown as it came.
 * `limitReached`: the local list is full, nothing was sent.
 * `limitMayHaveChanged`: a create was refused by a rule (empty `data` in the body, no such entry) while this device counted fewer entries than the limit.
 * `fileRefused`: the server refused a file by its content; `field` and `reason` say which and why.
 * `notMaster`: the game's master is someone else now.
 * `stagePublishFailed`: the table was not updated. After a save the entry is saved (`saved`) and `republishMedia` retries
 *   the table alone; the publish was quiet, so the form's own wording is the one message. Before a delete the entry stays
 *   on the table and is not deleted; the stage writer has already said so, so the panel adds nothing.
 * `aborted`: the upload was cancelled because the session or the game closed; the form can ignore it.
 */
export class MediaWriteError<S = MediaEntries[MediaKind]> extends Error {
  constructor(
    public kind: MediaWriteKind,
    public override cause?: unknown,
    public saved?: S,
    public refusal?: FileRefusal,
  ) {
    super(kind)
    this.name = 'MediaWriteError'
  }
}

/** One file field of a kind's collection. */
export interface FileField {
  name: string
  kind: 'image' | 'audio'
  required: boolean
}

/** How a kind's entry is told apart on the stage: used to publish, re-publish and clear it. */
export interface LiveHooks<E> {
  /** Is the entry with this id the one shown at the table? */
  isLive(stage: Stage, id: string): boolean
  /** Does the stage already point at the entry's stored files? */
  inSync(stage: Stage, entry: E): boolean
  publish(stage: Stage, entry: E): Stage
  clear(stage: Stage): Stage
}

/** Everything the generic path needs to know about one kind. */
export interface MediaKindSpec<E extends { id: string }> {
  collection: MediaKind
  files: readonly FileField[]
  limit: number
  /** The entry a row stands for; null when it fails the shape check. */
  fromRow(row: MediaRow): E | null
  /** The `data` to store, or null when the draft is invalid. `has` says which file fields end up with a file. */
  checkDraft(draft: MediaDraft, has: Record<string, boolean>): { id: string } | null
  /** The stored file name of each file field, null when absent. */
  stored(entry: E): Record<string, string | null>
  live?: LiveHooks<E>
}

type KindTable = { [K in MediaKind]: MediaKindSpec<MediaEntries[K]> }

function sceneFromRow(row: MediaRow): Scene | null {
  const data = checkSceneData(row.data)
  if (!data || data.id !== row.id) {
    log.warn('dropping a scene that fails the shape check', { id: row.id })
    return null
  }
  return {
    id: row.id,
    name: data.name,
    image: typeof row.image === 'string' && row.image ? row.image : null,
    sound: typeof row.sound === 'string' && row.sound ? row.sound : null,
  }
}

function soundFromRow(row: MediaRow): Sound | null {
  const data = checkSoundData(row.data)
  if (!data || data.id !== row.id || typeof row.file !== 'string' || !row.file) {
    log.warn('dropping a sound that fails the shape check', { id: row.id })
    return null
  }
  return {
    id: row.id,
    name: data.name,
    loop: data.loop,
    duration: data.duration,
    file: row.file,
  }
}

function imageFromRow(row: MediaRow): TableImage | null {
  const data = checkImageData(row.data)
  if (!data || data.id !== row.id || typeof row.file !== 'string' || !row.file) {
    log.warn('dropping an image that fails the shape check', { id: row.id })
    return null
  }
  return { id: row.id, caption: data.caption, file: row.file }
}

function sceneInSync(stage: Stage, scene: Scene): boolean {
  return (stage.scene?.image?.name ?? null) === scene.image && (stage.scene?.sound?.name ?? null) === scene.sound
}

/** The kinds this transport handles. A kind joins by one entry here; the form and the panel come with it. */
export const mediaKinds: KindTable = {
  scenes: {
    collection: 'scenes',
    files: [{ name: 'image', kind: 'image', required: false }, { name: 'sound', kind: 'audio', required: false }],
    limit: MEDIA_LIMITS.scenes,
    fromRow: sceneFromRow,
    checkDraft: (draft, has) => {
      const name = typeof draft.name === 'string' ? draft.name : ''
      const problems = checkSceneDraft({ name, hasImage: !!has.image, hasSound: !!has.sound })
      const data = checkSceneData({ id: draft.id, name })
      return problems.length ? null : data
    },
    stored: scene => ({ image: scene.image, sound: scene.sound }),
    live: {
      isLive: (stage, id) => stage.scene?.id === id,
      inSync: sceneInSync,
      publish: withScene,
      clear: withoutScene,
    },
  },
  sounds: {
    collection: 'sounds',
    files: [{ name: 'file', kind: 'audio', required: true }],
    limit: MEDIA_LIMITS.sounds,
    fromRow: soundFromRow,
    checkDraft: (draft, has) => {
      const name = typeof draft.name === 'string' ? draft.name : ''
      if (checkSoundDraft({ name, hasFile: !!has.file }).length) return null
      const data = checkSoundData({ id: draft.id, name, loop: draft.loop, duration: draft.duration })
      if (!data) return null
      return data.duration === null ? { id: data.id, name: data.name, loop: data.loop } : data
    },
    stored: sound => ({ file: sound.file }),
    live: {
      isLive: (stage, id) => stage.sound?.id === id,
      // A changed name or loop flag applies from the next play, so a data-only update never re-publishes.
      inSync: () => true,
      publish: (stage, sound) => withSound(stage, sound, new Date().toISOString()),
      clear: withoutSound,
    },
  },
  images: {
    collection: 'images',
    files: [{ name: 'file', kind: 'image', required: true }],
    limit: MEDIA_LIMITS.images,
    fromRow: imageFromRow,
    checkDraft: (draft, has) => {
      const caption = typeof draft.caption === 'string' ? draft.caption : ''
      if (checkImageDraft({ caption, hasFile: !!has.file }).length) return null
      return checkImageData({ id: draft.id, caption })
    },
    stored: image => ({ file: image.file }),
    live: {
      isLive: (stage, id) => stage.image?.id === id,
      // An edit that changes nothing the stage shows (a caption edit while it is shown without one) publishes nothing:
      // `withImageEdited` hands the same stage back then.
      inSync: (stage, image) => withImageEdited(stage, image) === stage,
      publish: withImageEdited,
      clear: withoutImage,
    },
  },
}

function specOf<K extends MediaKind>(kind: K): MediaKindSpec<MediaEntries[K]> {
  return mediaKinds[kind] as MediaKindSpec<MediaEntries[K]>
}

const listOf = <K extends MediaKind>(kind: K): MediaEntries[K][] => useMediaStore()[kind].list as MediaEntries[K][]

/** Where the server serves a stored file at the size of a thumbnail. */
export function mediaThumb(ref: FileRef, size: string): string {
  return fileUrl(pb.baseURL, ref, size)
}

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : undefined
}

// PocketBase words a file refusal as `data.<field>.code` inside the body, which the SDK keeps in `response`
// (see `responseError.ts`); a rule refusal has an empty `data`.
function fileRefusal(spec: MediaKindSpec<{ id: string }>, err: unknown): FileRefusal | null {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return null
  const data = err.response.data
  if (typeof data !== 'object' || data === null) return null
  for (const { name: field } of spec.files) {
    const code = (data as Record<string, { code?: unknown } | undefined>)[field]?.code
    if (code === 'validation_invalid_mime_type') return { field, reason: 'type' }
    if (code === 'validation_file_size_limit') return { field, reason: 'size' }
  }
  return null
}

let openGen = 0
// Per kind, the events that arrive while that kind's list loads; null once it has loaded.
const held = new Map<MediaKind, (() => void)[] | null>()

// Events that arrive while the list loads are replayed on top of it.
function onEvent(gen: number, kind: MediaKind, apply: () => void) {
  if (gen !== openGen) return
  const queue = held.get(kind)
  if (queue) queue.push(apply)
  else apply()
}

// A player's client never subscribes, so it never sends an unsubscribe either.
const listening = new Set<MediaKind>()

function unsubscribeKind(kind: MediaKind) {
  if (!listening.delete(kind)) return
  // Fails whenever the network has just dropped, which is a normal way to get here.
  pb.collection(kind).unsubscribe('*').catch((err: unknown) => log.debug('unsubscribe failed', { kind, err }))
}

function unsubscribeOwn() {
  for (const kind of [...listening]) unsubscribeKind(kind)
}

/**
 * Master: subscribes to the game's media, then loads them, each kind on its own. Events that arrive
 * during a load are held and replayed on top of it. A failure leaves that kind's slot `failed` and is not rethrown.
 */
export function openMedia(gameId: string): Promise<void> {
  if (inflight?.gameId === gameId) return inflight.promise
  const promise = run(gameId).finally(() => {
    if (inflight?.promise === promise) inflight = null
  })
  inflight = { gameId, promise }
  return promise
}

// A second open of the same game while its load runs shares that load instead of listing and subscribing again.
let inflight: { gameId: string; promise: Promise<void> } | null = null

// One request in flight per upload: closing the session or moving to another game cancels them.
const uploads = new Set<{ gameId: string; controller: AbortController }>()

function abortUploads(except?: string) {
  for (const u of uploads) if (u.gameId !== except) u.controller.abort()
}

async function run(gameId: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const gen = ++openGen
  const store = useMediaStore()
  const open = () => gen === openGen && current() && store.gameId === gameId
  abortUploads(gameId)
  unsubscribeOwn()
  const kinds = Object.keys(mediaKinds) as MediaKind[]
  store.startLoading(gameId, kinds)
  held.clear()
  for (const kind of kinds) held.set(kind, [])
  try {
    await Promise.all(kinds.map(kind => loadKind(kind, gameId, gen, open)))
  } finally {
    if (gen === openGen) held.clear()
  }
}

async function loadKind<K extends MediaKind>(kind: K, gameId: string, gen: number, open: () => boolean): Promise<void> {
  const spec = specOf(kind)
  const store = useMediaStore()
  listening.add(kind)
  try {
    await call(() => pb.collection(kind).subscribe<MediaRow>('*', (e) => {
      if (e.record.game !== gameId || store.gameId !== gameId) return
      if (e.action === 'delete') {
        onEvent(gen, kind, () => store.remove(kind, gameId, e.record.id))
        return
      }
      const entry = spec.fromRow(e.record)
      if (entry) onEvent(gen, kind, () => store.put(kind, gameId, entry))
    }))
    if (!open()) return
    const rows = await call(() => pb.collection(kind).getFullList<MediaRow>({
      filter: pb.filter('game = {:g}', { g: gameId }),
      sort: 'created',
    }))
    if (!open()) return
    store.setList(kind, gameId, rows.map(r => spec.fromRow(r)).filter((e): e is MediaEntries[K] => e !== null))
    const events = held.get(kind) ?? []
    held.set(kind, null)
    for (const apply of events) apply()
  } catch (err) {
    log.warn('open failed', { kind, gameId, err })
    // The list did not load, so nothing is listened to until a retry replaces it.
    if (open()) {
      store.setFailed(kind, gameId)
      unsubscribeKind(kind)
    }
  }
}

/** Stops listening; the store keeps its data, which a reopen of the same game refreshes in place. */
export function closeMedia(): void {
  openGen += 1
  held.clear()
  inflight = null
  abortUploads()
  unsubscribeOwn()
}

type ReadyFiles = Record<string, File | null | undefined>

async function checkedFiles(spec: MediaKindSpec<{ id: string }>, files: MediaFiles): Promise<ReadyFiles> {
  const out: ReadyFiles = {}
  for (const field of spec.files) {
    const given = files[field.name]
    const file = given && field.kind === 'image' ? await fitImage(given, IMAGE_MAX_BYTES) : given
    if (file && checkUpload(field.kind, file) !== 'ok') throw new Error(`invalid ${field.name}`)
    out[field.name] = file
  }
  return out
}

// The form checks first, so a failure here is a developer error.
function checkedData(spec: MediaKindSpec<{ id: string }>, draft: MediaDraft, has: Record<string, boolean>): { id: string } {
  const missing = spec.files.filter(f => f.required && !has[f.name]).map(f => f.name)
  const data = spec.checkDraft(draft, has)
  if (missing.length || !data) throw new Error(`invalid ${spec.collection} entry: ${missing.join(', ') || 'draft'}`)
  return data
}

function addFiles(form: FormData, spec: MediaKindSpec<{ id: string }>, files: ReadyFiles) {
  for (const field of spec.files) {
    const file = files[field.name]
    if (file === undefined) continue
    // An empty value clears a file field.
    if (file === null) form.append(field.name, '')
    else form.append(field.name, file, neutralFileName(field.kind, file.type))
  }
}

function savedEntry<K extends MediaKind>(spec: MediaKindSpec<MediaEntries[K]>, row: MediaRow): MediaEntries[K] {
  const entry = spec.fromRow(row)
  if (!entry) throw new Error('the server answered with an entry that fails the shape check')
  return entry
}

async function upload(
  gameId: string,
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<MediaRow> {
  const entry = { gameId, controller: new AbortController() }
  uploads.add(entry)
  try {
    return await guard(() => sendForm<MediaRow>(method, path, form, onProgress, entry.controller.signal))
  } catch (err) {
    if (entry.controller.signal.aborted) throw new MediaWriteError('aborted', err)
    throw err
  } finally {
    uploads.delete(entry)
  }
}

const rowsPath = (kind: MediaKind) => `/api/collections/${kind}/records`

/** Master: adds an entry. Files go up under neutral names; an image is shrunk to fit first. */
export async function createMedia<K extends MediaKind>(
  kind: K,
  gameId: string,
  draft: MediaDraft,
  files: MediaFiles,
  onProgress?: (fraction: number) => void,
): Promise<MediaEntries[K]> {
  requireOnlineUser()
  const current = staysCurrent()
  const spec = specOf(kind)
  const store = useMediaStore()
  if (store[kind].list.length >= spec.limit) throw new MediaWriteError('limitReached')
  const data = checkedData(spec, draft, Object.fromEntries(spec.files.map(f => [f.name, !!files[f.name]])))
  const ready = await checkedFiles(spec, files)
  const form = new FormData()
  form.append('id', data.id)
  form.append('game', gameId)
  form.append('data', JSON.stringify(data))
  addFiles(form, spec, ready)
  let row: MediaRow
  try {
    row = await upload(gameId, 'POST', rowsPath(kind), form, onProgress)
  } catch (err) {
    const refused = fileRefusal(spec, err)
    if (refused) throw new MediaWriteError('fileRefused', err, undefined, refused)
    if (statusOf(err) === 400) {
      // A create whose answer was lost and is retried under the same id is refused because the entry exists.
      const existing = await existingEntry(kind, gameId, data.id, current)
      if (existing) return existing
      if (store[kind].list.length < spec.limit) throw new MediaWriteError('limitMayHaveChanged', err)
    }
    throw err
  }
  const entry = savedEntry(spec, row)
  if (current()) store.put(kind, gameId, entry)
  return entry
}

// The entry with this id, from the store or from one read; null when there is none.
async function existingEntry<K extends MediaKind>(kind: K, gameId: string, id: string, current: () => boolean): Promise<MediaEntries[K] | null> {
  const spec = specOf(kind)
  const store = useMediaStore()
  const known = store.gameId === gameId ? listOf(kind).find(e => e.id === id) : undefined
  if (known) return known
  let row: MediaRow
  try {
    row = await call(() => pb.collection(kind).getOne<MediaRow>(id))
  } catch {
    return null
  }
  if (row.game !== gameId) return null
  const entry = spec.fromRow(row)
  if (entry && current()) store.put(kind, gameId, entry)
  return entry
}

/**
 * The server answers 404 both for an entry that is already gone and for a player who is no longer the
 * master, so a 404 re-reads the game: still the master means the entry is gone; otherwise the game (with
 * its new master) goes into the store and the write fails as `notMaster`.
 */
async function stillMaster(gameId: string, me: string, current: () => boolean, err: unknown): Promise<boolean> {
  const game = toGame(await call(() => pb.collection('games').getOne<GameRow>(gameId)))
  if (game.master === me) return true
  if (current()) useGamesStore().upsertGame(game)
  throw new MediaWriteError('notMaster', err)
}

// A write that outlives its game or session must not publish or edit anything for it.
function holds(gameId: string, current: () => boolean): boolean {
  return current() && useMediaStore().gameId === gameId
}

/**
 * Master: renames an entry and changes its files. When it is the entry shown at the table and its stored files
 * changed, the table gets the new ones; if that publish fails the entry is still saved, and the error is a
 * `MediaWriteError('stagePublishFailed')` carrying it.
 */
export async function updateMedia<K extends MediaKind>(
  kind: K,
  gameId: string,
  draft: MediaDraft,
  files: MediaFiles,
  onProgress?: (fraction: number) => void,
): Promise<MediaEntries[K]> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  const spec = specOf(kind)
  const store = useMediaStore()
  const before = listOf(kind).find(e => e.id === draft.id)
  const stored = before ? spec.stored(before) : null
  // Without the entry in the store, an unchanged file is assumed to exist.
  const has = Object.fromEntries(spec.files.map(f => [
    f.name,
    !!files[f.name] || (files[f.name] === undefined && (stored ? stored[f.name] !== null : true)),
  ]))
  const data = checkedData(spec, draft, has)
  const ready = await checkedFiles(spec, files)
  const form = new FormData()
  form.append('data', JSON.stringify(data))
  addFiles(form, spec, ready)
  let row: MediaRow
  try {
    row = await upload(gameId, 'PATCH', `${rowsPath(kind)}/${encodeURIComponent(data.id)}`, form, onProgress)
  } catch (err) {
    const refused = fileRefusal(spec, err)
    if (refused) throw new MediaWriteError('fileRefused', err, undefined, refused)
    if (statusOf(err) === 404) await stillMaster(gameId, me, current, err)
    throw err
  }
  const saved = savedEntry(spec, row)
  if (!holds(gameId, current)) return saved
  store.put(kind, gameId, saved)
  const stage = useStageStore().stageOf(gameId)
  if (spec.live?.isLive(stage, saved.id) && !spec.live.inSync(stage, saved)) await publishLive(kind, gameId, saved, current)
  return saved
}

async function publishLive<K extends MediaKind>(kind: K, gameId: string, entry: MediaEntries[K], current: () => boolean): Promise<void> {
  const live = specOf(kind).live
  if (!live) return
  const stage = useStageStore().stageOf(gameId)
  if (!live.isLive(stage, entry.id)) return
  try {
    // Quiet: the sheet words this failure itself, with Try again, so the stage writer's toast would be a second message.
    await publishStage(live.publish(stage, entry), { quiet: true })
  } catch (err) {
    // The mode or the user changed first: nothing to report to a form that is gone.
    if (err instanceof WriteDropped || !current()) return
    throw new MediaWriteError<MediaEntries[K]>('stagePublishFailed', err, entry)
  }
}

/** Master: retries the table's update alone after `stagePublishFailed`; does nothing once the entry is no longer the live one. */
export async function republishMedia<K extends MediaKind>(kind: K, gameId: string, entry: MediaEntries[K]): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const live = specOf(kind).live
  if (!live?.isLive(useStageStore().stageOf(gameId), entry.id)) return
  await publishLive(kind, gameId, entry, current)
}

/** Master: deletes an entry. One shown at the table is taken off first, and kept if that fails. */
export async function deleteMedia(kind: MediaKind, gameId: string, id: string): Promise<void> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  const live = specOf(kind).live
  const stage = useStageStore().stageOf(gameId)
  if (live?.isLive(stage, id)) {
    if (!holds(gameId, current)) throw new MediaWriteError('aborted')
    try {
      await publishStage(live.clear(stage))
    } catch (err) {
      if (err instanceof WriteDropped) throw new MediaWriteError('aborted', err)
      // The stage writer has told the person the table was not updated; the entry stays, and nothing more is to be said.
      throw new MediaWriteError('stagePublishFailed', err)
    }
    if (!holds(gameId, current)) throw new MediaWriteError('aborted')
  }
  try {
    await call(() => pb.collection(kind).delete(id))
  } catch (err) {
    if (statusOf(err) !== 404) throw err
    await stillMaster(gameId, me, current, err)
  }
  if (current()) useMediaStore().remove(kind, gameId, id)
}

export function createScene(
  gameId: string,
  draft: { id: string; name: string },
  files: SceneFiles,
  onProgress?: (fraction: number) => void,
): Promise<Scene> {
  return createMedia('scenes', gameId, draft, files, onProgress)
}

export function updateScene(
  gameId: string,
  scene: { id: string; name: string },
  files: SceneFiles,
  onProgress?: (fraction: number) => void,
): Promise<Scene> {
  return updateMedia('scenes', gameId, scene, files, onProgress)
}

export function republishScene(gameId: string, scene: Scene): Promise<void> {
  return republishMedia('scenes', gameId, scene)
}

export function deleteScene(gameId: string, id: string): Promise<void> {
  return deleteMedia('scenes', gameId, id)
}

export type SoundDraft = { id: string; name: string; loop: boolean; duration: number | null }

export function createSound(gameId: string, draft: SoundDraft, file: File, onProgress?: (fraction: number) => void): Promise<Sound> {
  return createMedia('sounds', gameId, draft, { file }, onProgress)
}

/** Data only: a sound's file never changes, so the form has no file to send. */
export function updateSound(gameId: string, sound: SoundDraft): Promise<Sound> {
  return updateMedia('sounds', gameId, sound, {})
}

export function deleteSound(gameId: string, id: string): Promise<void> {
  return deleteMedia('sounds', gameId, id)
}

export type ImageDraft = { id: string; caption: string | null }

export function createImage(gameId: string, draft: ImageDraft, file: File, onProgress?: (fraction: number) => void): Promise<TableImage> {
  return createMedia('images', gameId, draft, { file }, onProgress)
}

/** Without a file the picture stays; saving the shown image re-publishes it only when what the table shows changed. */
export function updateImage(gameId: string, image: ImageDraft, file?: File, onProgress?: (fraction: number) => void): Promise<TableImage> {
  return updateMedia('images', gameId, image, file ? { file } : {}, onProgress)
}

export function republishImage(gameId: string, image: TableImage): Promise<void> {
  return republishMedia('images', gameId, image)
}

export function deleteImage(gameId: string, id: string): Promise<void> {
  return deleteMedia('images', gameId, id)
}
