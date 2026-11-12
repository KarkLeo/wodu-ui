import { pb, type GameRow, type SceneRow } from '@/transport/pb'
import { guard } from './backend'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { publishStage, WriteDropped } from './stage'
import { toGame } from './games'
import { sendForm } from '@/transport/upload'
import {
  IMAGE_MAX_BYTES, MEDIA_LIMITS, checkSceneData, checkSceneDraft, checkUpload, neutralFileName,
  withScene, withoutScene,
} from '@/domain/stage'
import { useGamesStore } from '@/stores/games'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import type { Scene, Stage } from '@/types/stage'
import { fitImage } from '@/utils/fitImage'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:media')

/** A file for each of the scene's two slots: a `File` replaces, `null` removes, `undefined` keeps. */
export interface SceneFiles { image?: File | null; sound?: File | null }

export type SceneWriteKind = 'limitReached' | 'limitMayHaveChanged' | 'fileRefused' | 'notMaster' | 'stagePublishFailed' | 'aborted'

/** A file the server refused: which field, and whether for its type or its size. */
export interface FileRefusal { field: 'image' | 'sound'; reason: 'type' | 'size' }

/**
 * The failures the form words differently; any other failure is thrown as it came.
 * `limitReached`: the local list is full, nothing was sent.
 * `limitMayHaveChanged`: a create was refused by a rule (empty `data` in the body, no such scene) while this device counted fewer scenes than the limit.
 * `fileRefused`: the server refused a file by its content; `field` and `reason` say which and why.
 * `notMaster`: the game's master is someone else now.
 * `stagePublishFailed`: the scene is saved (`scene`) but the table was not updated; `republishScene` retries that alone.
 * `aborted`: the upload was cancelled because the session or the game closed; the form can ignore it.
 */
export class SceneWriteError extends Error {
  constructor(
    public kind: SceneWriteKind,
    public override cause?: unknown,
    public scene?: Scene,
    public refusal?: FileRefusal,
  ) {
    super(kind)
    this.name = 'SceneWriteError'
  }

  get field(): FileRefusal['field'] | undefined { return this.refusal?.field }
  get reason(): FileRefusal['reason'] | undefined { return this.refusal?.reason }
}

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : undefined
}

// PocketBase words a file refusal as `data.<field>.code`; a rule refusal has an empty `data`.
function fileRefusal(err: unknown): FileRefusal | null {
  if (statusOf(err) !== 400 || typeof err !== 'object' || err === null) return null
  const e = err as { data?: unknown; response?: { data?: unknown } }
  const data = e.data ?? e.response?.data
  if (typeof data !== 'object' || data === null) return null
  for (const field of ['image', 'sound'] as const) {
    const code = (data as Record<string, { code?: unknown } | undefined>)[field]?.code
    if (code === 'validation_invalid_mime_type') return { field, reason: 'type' }
    if (code === 'validation_file_size_limit') return { field, reason: 'size' }
  }
  return null
}

const ROWS = '/api/collections/scenes/records'

export function sceneFromRow(row: SceneRow): Scene | null {
  const data = checkSceneData(row.data)
  if (!data || data.id !== row.id) {
    log.warn('dropping a scene that fails the shape check', { id: row.id })
    return null
  }
  return { id: row.id, name: data.name, image: row.image || null, sound: row.sound || null }
}

let openGen = 0
let held: (() => void)[] | null = null

// Events that arrive while the list loads are replayed on top of it.
function onEvent(gen: number, apply: () => void) {
  if (gen !== openGen) return
  if (held) held.push(apply)
  else apply()
}

// A player's client never subscribes, so it never sends an unsubscribe either.
let listening = false

function unsubscribeOwn() {
  if (!listening) return
  listening = false
  // Fails whenever the network has just dropped, which is a normal way to get here.
  pb.collection('scenes').unsubscribe('*').catch((err: unknown) => log.debug('unsubscribe failed', { err }))
}

/**
 * Master: subscribes to the game's scenes, then loads them. Events that arrive during the load are held and
 * replayed on top of it. A failure leaves the store `failed` and is not rethrown.
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
  store.startLoading(gameId)
  held = []
  listening = true
  try {
    await call(() => pb.collection('scenes').subscribe<SceneRow>('*', (e) => {
      if (e.record.game !== gameId || store.gameId !== gameId) return
      if (e.action === 'delete') {
        onEvent(gen, () => store.removeScene(gameId, e.record.id))
        return
      }
      const scene = sceneFromRow(e.record)
      if (scene) onEvent(gen, () => store.putScene(gameId, scene))
    }))
    if (!open()) return
    const rows = await call(() => pb.collection('scenes').getFullList<SceneRow>({
      filter: pb.filter('game = {:g}', { g: gameId }),
      sort: 'created',
    }))
    if (!open()) return
    store.setScenes(gameId, rows.map(sceneFromRow).filter((s): s is Scene => s !== null))
    const events = held ?? []
    held = null
    for (const apply of events) apply()
  } catch (err) {
    log.warn('open failed', { gameId, err })
    // The list did not load, so nothing is listened to until a retry replaces it.
    if (open()) {
      store.setFailed(gameId)
      unsubscribeOwn()
    }
  } finally {
    if (gen === openGen) held = null
  }
}

/** Stops listening; the store keeps its data, which a reopen of the same game refreshes in place. */
export function closeMedia(): void {
  openGen += 1
  held = null
  inflight = null
  abortUploads()
  unsubscribeOwn()
}

// The form checks first, so a failure here is a developer error.
function checkedName(name: string, id: string, hasImage: boolean, hasSound: boolean): { id: string; name: string } {
  const problems = checkSceneDraft({ name, hasImage, hasSound })
  const data = checkSceneData({ id, name })
  if (problems.length || !data) throw new Error(`invalid scene: ${problems.join(', ') || 'id'}`)
  return data
}

async function checkedFiles(files: SceneFiles): Promise<{ image: File | null | undefined; sound: File | null | undefined }> {
  const image = files.image ? await fitImage(files.image, IMAGE_MAX_BYTES) : files.image
  if (image && checkUpload('image', image) !== 'ok') throw new Error('invalid image')
  if (files.sound && checkUpload('audio', files.sound) !== 'ok') throw new Error('invalid sound')
  return { image, sound: files.sound }
}

function addFiles(form: FormData, files: { image: File | null | undefined; sound: File | null | undefined }) {
  for (const [field, file, kind] of [['image', files.image, 'image'], ['sound', files.sound, 'audio']] as const) {
    if (file === undefined) continue
    // An empty value clears a file field.
    if (file === null) form.append(field, '')
    else form.append(field, file, neutralFileName(kind, file.type))
  }
}

function savedScene(row: SceneRow): Scene {
  const scene = sceneFromRow(row)
  if (!scene) throw new Error('the server answered with a scene that fails the shape check')
  return scene
}

async function upload(
  gameId: string,
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<SceneRow> {
  const entry = { gameId, controller: new AbortController() }
  uploads.add(entry)
  try {
    return await guard(() => sendForm<SceneRow>(method, path, form, onProgress, entry.controller.signal))
  } catch (err) {
    if (entry.controller.signal.aborted) throw new SceneWriteError('aborted', err)
    throw err
  } finally {
    uploads.delete(entry)
  }
}

/** Master: adds a scene. Files go up under neutral names; the image is shrunk to fit first. */
export async function createScene(
  gameId: string,
  draft: { id: string; name: string },
  files: SceneFiles,
  onProgress?: (fraction: number) => void,
): Promise<Scene> {
  requireOnlineUser()
  const current = staysCurrent()
  const store = useMediaStore()
  if (store.scenes.list.length >= MEDIA_LIMITS.scenes) throw new SceneWriteError('limitReached')
  const data = checkedName(draft.name, draft.id, !!files.image, !!files.sound)
  const ready = await checkedFiles(files)
  const form = new FormData()
  form.append('id', data.id)
  form.append('game', gameId)
  form.append('data', JSON.stringify(data))
  addFiles(form, ready)
  let row: SceneRow
  try {
    row = await upload(gameId, 'POST', ROWS, form, onProgress)
  } catch (err) {
    const refused = fileRefusal(err)
    if (refused) throw new SceneWriteError('fileRefused', err, undefined, refused)
    if (statusOf(err) === 400) {
      // A create whose answer was lost and is retried under the same id is refused because the scene exists.
      const existing = await existingScene(gameId, data.id, current)
      if (existing) return existing
      if (store.scenes.list.length < MEDIA_LIMITS.scenes) throw new SceneWriteError('limitMayHaveChanged', err)
    }
    throw err
  }
  const scene = savedScene(row)
  if (current()) store.putScene(gameId, scene)
  return scene
}

// The scene with this id, from the store or from one read; null when there is none.
async function existingScene(gameId: string, id: string, current: () => boolean): Promise<Scene | null> {
  const store = useMediaStore()
  const known = store.gameId === gameId ? store.scenes.list.find(s => s.id === id) : undefined
  if (known) return known
  let row: SceneRow
  try {
    row = await call(() => pb.collection('scenes').getOne<SceneRow>(id))
  } catch {
    return null
  }
  if (row.game !== gameId) return null
  const scene = sceneFromRow(row)
  if (scene && current()) store.putScene(gameId, scene)
  return scene
}

/**
 * The server answers 404 both for a scene that is already gone and for a player who is no longer the
 * master, so a 404 re-reads the game: still the master means the scene is gone; otherwise the game (with
 * its new master) goes into the store and the write fails as `notMaster`.
 */
async function stillMaster(gameId: string, me: string, current: () => boolean, err: unknown): Promise<boolean> {
  const game = toGame(await call(() => pb.collection('games').getOne<GameRow>(gameId)))
  if (game.master === me) return true
  if (current()) useGamesStore().upsertGame(game)
  throw new SceneWriteError('notMaster', err)
}

// A write that outlives its game or session must not publish or edit anything for it.
function holds(gameId: string, current: () => boolean): boolean {
  return current() && useMediaStore().gameId === gameId
}

function pointsAt(stage: Stage, scene: Scene): boolean {
  return (stage.scene?.image?.name ?? null) === scene.image && (stage.scene?.sound?.name ?? null) === scene.sound
}

/**
 * Master: renames a scene and changes its files. When it is the scene shown at the table and its stored files
 * changed, the table gets the new ones; if that publish fails the scene is still saved, and the error is a
 * `SceneWriteError('stagePublishFailed')` carrying it.
 */
export async function updateScene(
  gameId: string,
  scene: { id: string; name: string },
  files: SceneFiles,
  onProgress?: (fraction: number) => void,
): Promise<Scene> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  const store = useMediaStore()
  const before = store.scenes.list.find(s => s.id === scene.id)
  const keeps = (field: 'image' | 'sound') => files[field] === undefined && (before ? before[field] !== null : true)
  const data = checkedName(scene.name, scene.id, !!files.image || keeps('image'), !!files.sound || keeps('sound'))
  const ready = await checkedFiles(files)
  const form = new FormData()
  form.append('data', JSON.stringify(data))
  addFiles(form, ready)
  let row: SceneRow
  try {
    row = await upload(gameId, 'PATCH', `${ROWS}/${encodeURIComponent(data.id)}`, form, onProgress)
  } catch (err) {
    const refused = fileRefusal(err)
    if (refused) throw new SceneWriteError('fileRefused', err, undefined, refused)
    if (statusOf(err) === 404) await stillMaster(gameId, me, current, err)
    throw err
  }
  const saved = savedScene(row)
  if (!holds(gameId, current)) return saved
  store.putScene(gameId, saved)
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id === saved.id && !pointsAt(stage, saved)) await publishLive(gameId, saved, current)
  return saved
}

async function publishLive(gameId: string, scene: Scene, current: () => boolean): Promise<void> {
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id !== scene.id) return
  try {
    await publishStage(withScene(stage, scene))
  } catch (err) {
    // The mode or the user changed first: nothing to report to a form that is gone.
    if (err instanceof WriteDropped || !current()) return
    throw new SceneWriteError('stagePublishFailed', err, scene)
  }
}

/** Master: retries the table's update alone after `stagePublishFailed`; does nothing once the scene is no longer the live one. */
export async function republishScene(gameId: string, scene: Scene): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id !== scene.id) return
  await publishLive(gameId, scene, current)
}

/** Master: deletes a scene. A scene shown at the table is taken off first, and kept if that fails. */
export async function deleteScene(gameId: string, id: string): Promise<void> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id === id) {
    if (!holds(gameId, current)) throw new SceneWriteError('aborted')
    try {
      await publishStage(withoutScene(stage))
    } catch (err) {
      if (err instanceof WriteDropped) throw new SceneWriteError('aborted', err)
      throw err
    }
    if (!holds(gameId, current)) throw new SceneWriteError('aborted')
  }
  try {
    await call(() => pb.collection('scenes').delete(id))
  } catch (err) {
    if (statusOf(err) !== 404) throw err
    await stillMaster(gameId, me, current, err)
  }
  if (current()) useMediaStore().removeScene(gameId, id)
}
