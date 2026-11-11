import { pb, type GameRow, type SceneRow } from '@/transport/pb'
import { guard } from './backend'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { publishStage } from './stage'
import { toGame } from './games'
import { sendForm } from '@/transport/upload'
import {
  IMAGE_MAX_BYTES, MEDIA_LIMITS, checkSceneData, checkSceneDraft, checkUpload, neutralFileName,
  withScene, withoutScene,
} from '@/domain/stage'
import { useGamesStore } from '@/stores/games'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import type { Scene } from '@/types/stage'
import { fitImage } from '@/utils/fitImage'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:media')

/** A file for each of the scene's two slots: a `File` replaces, `null` removes, `undefined` keeps. */
export interface SceneFiles { image?: File | null; sound?: File | null }

/**
 * The two failures the form words differently; any other failure is thrown as it came.
 * `limitMayHaveChanged`: a create was refused while this device counted fewer scenes than the limit.
 * `notMaster`: the game's master is someone else now.
 */
export class SceneWriteError extends Error {
  constructor(public kind: 'limitMayHaveChanged' | 'notMaster', public override cause?: unknown) {
    super(kind)
    this.name = 'SceneWriteError'
  }
}

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : undefined
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
export async function openMedia(gameId: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const gen = ++openGen
  const store = useMediaStore()
  const open = () => gen === openGen && current() && store.gameId === gameId
  unsubscribeOwn()
  store.startLoading(gameId)
  held = []
  listening = true
  try {
    await call(() => pb.collection('scenes').subscribe<SceneRow>('*', (e) => {
      if (e.record.game !== gameId || store.gameId !== gameId) return
      if (e.action === 'delete') {
        onEvent(gen, () => store.removeScene(e.record.id))
        return
      }
      const scene = sceneFromRow(e.record)
      if (scene) onEvent(gen, () => store.putScene(scene))
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
    if (open()) store.setFailed(gameId)
  } finally {
    if (gen === openGen) held = null
  }
}

/** Stops listening; the store keeps its data, which a reopen of the same game refreshes in place. */
export function closeMedia(): void {
  openGen += 1
  held = null
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
  const data = checkedName(draft.name, draft.id, !!files.image, !!files.sound)
  const ready = await checkedFiles(files)
  const form = new FormData()
  form.append('id', data.id)
  form.append('game', gameId)
  form.append('data', JSON.stringify(data))
  addFiles(form, ready)
  let row: SceneRow
  try {
    row = await guard(() => sendForm<SceneRow>('POST', ROWS, form, onProgress))
  } catch (err) {
    if (statusOf(err) === 400 && store.scenes.list.length < MEDIA_LIMITS.scenes) throw new SceneWriteError('limitMayHaveChanged', err)
    throw err
  }
  const scene = savedScene(row)
  if (current()) store.putScene(scene)
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

/** Master: renames a scene and changes its files. When it is the scene shown at the table, the table gets the new files. */
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
    row = await guard(() => sendForm<SceneRow>('PATCH', `${ROWS}/${encodeURIComponent(data.id)}`, form, onProgress))
  } catch (err) {
    if (statusOf(err) === 404) await stillMaster(gameId, me, current, err)
    throw err
  }
  const saved = savedScene(row)
  if (current()) store.putScene(saved)
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id === saved.id) await publishStage(withScene(stage, saved))
  return saved
}

/** Master: deletes a scene. A scene shown at the table is taken off first, and kept if that fails. */
export async function deleteScene(gameId: string, id: string): Promise<void> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  const stage = useStageStore().stageOf(gameId)
  if (stage.scene?.id === id) await publishStage(withoutScene(stage))
  try {
    await call(() => pb.collection('scenes').delete(id))
  } catch (err) {
    if (statusOf(err) !== 404) throw err
    await stillMaster(gameId, me, current, err)
  }
  if (current()) useMediaStore().removeScene(id)
}
