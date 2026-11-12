import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Scene, Sound, TableImage } from '@/types/stage'
import { RECORDED } from './recordedResponses'
import { errorFromResponse } from './responseError'

interface Call { collection: string; method: string; args: unknown[] }
interface Sent { method: string; path: string; form: FormData; signal?: AbortSignal }

const calls: Call[] = []
const sent: Sent[] = []
let stays = true
let sendImpl: (s: Sent) => Promise<unknown>
let stageUpdateImpl: () => Promise<unknown>
let deleteImpl: () => Promise<unknown>
let gameMaster = 'user-1'
let listRows: unknown[] = []
let listFails = false
let soundsListFails = false
let soundRows: unknown[] = []
let sceneGetImpl: (id: string) => Promise<unknown>
let soundGetImpl: (id: string) => Promise<unknown>
let imageRows: unknown[] = []
let imageGetImpl: (id: string) => Promise<unknown>
let fitImpl: (f: File) => Promise<File>
const fitCalls: Array<[File, number]> = []

vi.mock('@/transport/pb', () => ({
  pb: {
    filter: (raw: string) => raw,
    collection: (collection: string) => new Proxy({}, {
      get: (_t, method: string) => (...args: unknown[]) => {
        calls.push({ collection, method, args })
        if (collection === 'stages' && method === 'update') return stageUpdateImpl()
        if ((collection === 'scenes' || collection === 'sounds' || collection === 'images') && method === 'delete') return deleteImpl()
        if (collection === 'scenes' && method === 'getFullList') return listFails ? Promise.reject(new Error('refused')) : Promise.resolve(listRows)
        if (collection === 'sounds' && method === 'getFullList') return soundsListFails ? Promise.reject(new Error('refused')) : Promise.resolve(soundRows)
        if (collection === 'images' && method === 'getFullList') return Promise.resolve(imageRows)
        if (collection === 'images' && method === 'getOne') return imageGetImpl(String(args[0]))
        if (collection === 'scenes' && method === 'getOne') return sceneGetImpl(String(args[0]))
        if (collection === 'sounds' && method === 'getOne') return soundGetImpl(String(args[0]))
        if (collection === 'games' && method === 'getOne') {
          return Promise.resolve({ id: 'game-1', name: 'G', master: gameMaster, invite_code: 'ABCD2345' })
        }
        return Promise.resolve(method === 'subscribe' ? () => Promise.resolve() : {})
      },
    }),
  },
}))
vi.mock('@/utils/fitImage', () => ({
  fitImage: (f: File, max: number) => { fitCalls.push([f, max]); return fitImpl(f) },
}))
vi.mock('./onlineOps', () => ({
  call: <T>(op: () => Promise<T>) => op(),
  requireOnlineUser: () => 'user-1',
  staysCurrent: () => () => stays,
}))
vi.mock('./backend', () => ({ guard: <T>(op: () => Promise<T>) => op() }))
vi.mock('./games', () => ({
  toGame: (r: { id: string; name: string; master: string; invite_code: string }) => ({ id: r.id, name: r.name, master: r.master, inviteCode: r.invite_code }),
}))
vi.mock('./mode', () => ({ modeSession: () => 1 }))
vi.mock('./writeFailure', () => ({ reportWriteFailure: () => {} }))
vi.mock('./upload', () => ({
  sendForm: (method: string, path: string, form: FormData, _progress?: unknown, signal?: AbortSignal) => {
    const s = { method, path, form, signal }
    sent.push(s)
    return sendImpl(s)
  },
}))

const GAME = 'game-1'
function deferred() {
  let resolve!: (v?: unknown) => void
  const promise = new Promise<unknown>((res) => { resolve = res })
  return { promise, resolve }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
// Errors are built the way `sendForm` builds them, from what a real PocketBase answered.
const httpError = (status: number) => errorFromResponse('', status, JSON.stringify({ data: {}, message: 'status', status }))
const recorded = (key: keyof typeof RECORDED) => errorFromResponse('', RECORDED[key].status, RECORDED[key].body)
const file = (name: string, type: string) => new File(['x'], name, { type })

function imageRow(id: string, over: Record<string, unknown> = {}) {
  return { id, game: GAME, data: { id, caption: `Caption ${id}` }, file: 'image.jpg', ...over }
}

function soundRow(id: string, over: Record<string, unknown> = {}) {
  return { id, game: GAME, data: { id, name: `Sound ${id}`, loop: false, duration: 12 }, file: 'sound.mp3', ...over }
}

function row(id: string, over: Record<string, unknown> = {}) {
  return { id, game: GAME, data: { id, name: `Scene ${id}` }, image: '', sound: '', ...over }
}

async function load() {
  vi.resetModules()
  setActivePinia(createPinia())
  const transport = await import('./media')
  const { useMediaStore } = await import('@/stores/media')
  const { useStageStore } = await import('@/stores/stage')
  const { useGamesStore } = await import('@/stores/games')
  useGamesStore().upsertGame({ id: GAME, name: 'G', master: 'user-1', inviteCode: 'ABCD2345' })
  // The game's stage row exists, as it does once anything was ever shown, so stage writes are updates.
  const { applyStages } = await import('./stage')
  applyStages([{ id: GAME, game: GAME, data: { id: GAME, scene: null, image: null, sound: null } }])
  const media = useMediaStore()
  media.startLoading(GAME, ['scenes', 'sounds', 'images'])
  return { ...transport, media, stages: useStageStore() }
}

const stagePublishes = () => calls.filter(c => c.collection === 'stages' && c.method === 'update')
const imageDeletes = () => calls.filter(c => c.collection === 'images' && c.method === 'delete')
const soundDeletes = () => calls.filter(c => c.collection === 'sounds' && c.method === 'delete')
const sceneDeletes = () => calls.filter(c => c.collection === 'scenes' && c.method === 'delete')

beforeEach(() => {
  calls.length = 0
  sent.length = 0
  stays = true
  gameMaster = 'user-1'
  listRows = []
  listFails = false
  soundsListFails = false
  soundRows = []
  imageRows = []
  fitCalls.length = 0
  fitImpl = async f => f
  imageGetImpl = async () => { throw httpError(404) }
  sceneGetImpl = async () => { throw httpError(404) }
  soundGetImpl = async () => { throw httpError(404) }
  sendImpl = async s => row(String(s.form.get('id') ?? 'sc-1'), { image: 'image.jpg', sound: 'sound.mp3' })
  stageUpdateImpl = async () => ({})
  deleteImpl = async () => true
})

describe('openMedia', () => {
  it('lists the game, drops a row that fails the shape check and maps file names', async () => {
    listRows = [
      row('a', { image: 'image.webp' }),
      row('b', { data: { id: 'other', name: 'Wrong id' } }),
      row('c', { data: { name: 'No id' } }),
      row('d', { sound: 'sound.mp3' }),
    ]
    const { openMedia, media } = await load()
    await openMedia(GAME)
    expect(media.scenes.status).toBe('ready')
    expect(media.scenes.list).toEqual<Scene[]>([
      { id: 'a', name: 'Scene a', image: 'image.webp', sound: null },
      { id: 'd', name: 'Scene d', image: null, sound: 'sound.mp3' },
    ])
    expect(calls.filter(c => c.collection === 'scenes' && c.method === 'subscribe')).toHaveLength(1)
  })
})

describe('createScene', () => {
  it('sends the ids, the JSON data and the files under their neutral names', async () => {
    const { createScene, media } = await load()
    const scene = await createScene(
      GAME,
      { id: 'sc-1', name: '  Crypt ' },
      { image: file('My Picture FINAL.JPG', 'image/jpeg'), sound: file('track (1).mp3', 'audio/mpeg') },
    )
    expect(sent).toHaveLength(1)
    const { method, path, form } = sent[0]!
    expect(method).toBe('POST')
    expect(path).toBe('/api/collections/scenes/records')
    expect(form.get('id')).toBe('sc-1')
    expect(form.get('game')).toBe(GAME)
    expect(JSON.parse(String(form.get('data')))).toEqual({ id: 'sc-1', name: 'Crypt' })
    expect((form.get('image') as File).name).toBe('image.jpg')
    expect((form.get('sound') as File).name).toBe('sound.mp3')
    expect(scene).toEqual({ id: 'sc-1', name: 'Scene sc-1', image: 'image.jpg', sound: 'sound.mp3' })
    expect(media.scenes.list.map(s => s.id)).toEqual(['sc-1'])
  })

  it('refuses a draft that fails the checks before any request', async () => {
    const { createScene } = await load()
    await expect(createScene(GAME, { id: 'sc-1', name: '' }, { image: file('a.png', 'image/png') })).rejects.toThrow()
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, {})).rejects.toThrow()
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.ogg', 'audio/ogg') })).rejects.toThrow()
    expect(sent).toHaveLength(0)
  })

  it('raises limitMayHaveChanged when the server refuses while the local count is under the limit', async () => {
    sendImpl = async () => { throw recorded('createDuplicateId') }
    const { createScene } = await load()
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'limitMayHaveChanged' })
  })

  it('maps a refused file field to fileRefused with the field and the reason, not to a limit change', async () => {
    const { createScene } = await load()
    sendImpl = async () => { throw recorded('createTextAsSound') }
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'sound', reason: 'type' })
    sendImpl = async () => { throw recorded('createBigImage') }
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { image: file('a.png', 'image/png') }))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'image', reason: 'size' })
  })

  it('counts an empty-data 400 as done when the scene with that id is already in the store (answer lost, retried)', async () => {
    sendImpl = async () => { throw recorded('createDuplicateId') }
    const { createScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'X', image: null, sound: 'sound.mp3' })
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .resolves.toEqual({ id: 'sc-1', name: 'X', image: null, sound: 'sound.mp3' })
  })

  it('counts an empty-data 400 as done when one read of that id finds the scene, and stores it', async () => {
    sendImpl = async () => { throw recorded('createDuplicateId') }
    sceneGetImpl = async () => row('sc-1', { sound: 'sound.mp3', data: { id: 'sc-1', name: 'X' } })
    const { createScene, media } = await load()
    const scene = await createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    expect(scene.id).toBe('sc-1')
    expect(media.scenes.list.map(s => s.id)).toEqual(['sc-1'])
    expect(calls.some(c => c.collection === 'scenes' && c.method === 'getOne' && c.args[0] === 'sc-1')).toBe(true)
  })

  it('raises limitMayHaveChanged only for an empty-data 400 with no such scene', async () => {
    sendImpl = async () => { throw recorded('create21st') }
    const { createScene } = await load()
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'limitMayHaveChanged' })
  })

  it('refuses locally, with nothing sent, when the list is already at the limit', async () => {
    const { createScene, media } = await load()
    const { MEDIA_LIMITS } = await import('@/domain/stage')
    for (let i = 0; i < MEDIA_LIMITS.scenes; i++) media.put('scenes', GAME, { id: `s${i}`, name: 'n', image: null, sound: 'sound.mp3' })
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'limitReached' })
    expect(sent).toHaveLength(0)
  })

  it('does not put a late answer into a store that was cleared or switched to another game', async () => {
    const gate = deferred()
    sendImpl = () => gate.promise
    const { createScene, media } = await load()
    const done = createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    media.clearAll()
    gate.resolve(row('sc-1', { sound: 'sound.mp3' }))
    await done
    expect(media.scenes.list).toEqual([])
    expect(media.gameId).toBeNull()
    const other = deferred()
    sendImpl = () => other.promise
    const second = createScene(GAME, { id: 'sc-2', name: 'Y' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    media.startLoading('game-2', ['scenes', 'sounds'])
    other.resolve(row('sc-2', { sound: 'sound.mp3' }))
    await second
    expect(media.scenes.list).toEqual([])
  })

  it('writes nothing to the store once the session has ended', async () => {
    const gate = deferred()
    sendImpl = () => gate.promise
    const { createScene, media } = await load()
    const done = createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    stays = false
    gate.resolve(row('sc-1', { sound: 'sound.mp3' }))
    await done
    expect(media.scenes.list).toEqual([])
  })

  it('aborts an upload in flight when the media closes, and rejects as aborted', async () => {
    sendImpl = s => new Promise((_res, rej) => {
      s.signal!.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { status: 0, isAbort: true })))
    })
    const { createScene, closeMedia } = await load()
    const done = createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    closeMedia()
    await expect(done).rejects.toMatchObject({ kind: 'aborted' })
  })
})

describe('an upload and a re-open of the same game', () => {
  it('is not aborted by the re-open that follows a connection blip, and its result is stored', async () => {
    const gate = deferred()
    sendImpl = async (s) => {
      await gate.promise
      if (s.signal!.aborted) throw Object.assign(new Error('abort'), { status: 0, isAbort: true })
      return row('sc-1', { sound: 'sound.mp3' })
    }
    const { createScene, openMedia, media } = await load()
    await openMedia(GAME)
    const done = createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    await openMedia(GAME)
    expect(sent[0]!.signal!.aborted).toBe(false)
    gate.resolve()
    await expect(done).resolves.toMatchObject({ id: 'sc-1' })
    expect(media.scenes.list.map(s => s.id)).toContain('sc-1')
  })

  it('is aborted when another game opens', async () => {
    sendImpl = s => new Promise((_res, rej) => {
      s.signal!.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { status: 0, isAbort: true })))
    })
    const { createScene, openMedia } = await load()
    const done = createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    await openMedia('game-2')
    await expect(done).rejects.toMatchObject({ kind: 'aborted' })
  })
})

describe('updateScene', () => {
  it('sends a File as the file, null as an empty value and leaves undefined out', async () => {
    sendImpl = async () => row('sc-1', { image: 'image.png' })
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' })
    await updateScene(GAME, { id: 'sc-1', name: 'New' }, { image: file('x.png', 'image/png'), sound: null })
    const { method, path, form } = sent[0]!
    expect(method).toBe('PATCH')
    expect(path).toBe('/api/collections/scenes/records/sc-1')
    expect((form.get('image') as File).name).toBe('image.png')
    expect(form.get('sound')).toBe('')
    expect(form.has('id')).toBe(false)
    sent.length = 0
    await updateScene(GAME, { id: 'sc-1', name: 'New' }, {})
    expect(sent[0]!.form.has('image')).toBe(false)
    expect(sent[0]!.form.has('sound')).toBe(false)
  })

  it('re-publishes the live scene with its new stored names', async () => {
    sendImpl = async () => row('sc-1', { image: 'image.png', sound: '' })
    const { updateScene, media, stages } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' })
    const { withScene } = await import('@/domain/stage')
    stages.set(withScene(stages.stageOf(GAME), { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' }))
    await updateScene(GAME, { id: 'sc-1', name: 'New' }, { image: file('x.png', 'image/png'), sound: null })
    expect(stagePublishes()).toHaveLength(1)
    const published = (stagePublishes()[0]!.args[1] as { data: { scene: unknown } }).data
    expect(published.scene).toEqual({
      id: 'sc-1',
      image: { collection: 'scenes', record: 'sc-1', name: 'image.png' },
      sound: null,
    })
  })

  it('does not touch the stage when the scene is not the live one', async () => {
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await updateScene(GAME, { id: 'sc-1', name: 'New' }, {})
    expect(stagePublishes()).toHaveLength(0)
  })

  it('maps a refused file on update to fileRefused', async () => {
    sendImpl = async () => { throw recorded('updateTextAsImage') }
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await expect(updateScene(GAME, { id: 'sc-1', name: 'New' }, { image: file('x.png', 'image/png') }))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'image', reason: 'type' })
  })

  it('maps a refused sound on update to fileRefused on the sound field', async () => {
    sendImpl = async () => { throw recorded('updateTextAsSound') }
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await expect(updateScene(GAME, { id: 'sc-1', name: 'New' }, { sound: file('x.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'sound', reason: 'type' })
  })

  it('keeps a 404 on update as what it was: a re-read of the game, not a file refusal', async () => {
    sendImpl = async () => { throw recorded('updateNotFound') }
    gameMaster = 'user-2'
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await expect(updateScene(GAME, { id: 'sc-1', name: 'New' }, { image: file('x.png', 'image/png') }))
      .rejects.toMatchObject({ kind: 'notMaster' })
  })

  it('raises notMaster on a 404 when the game now has another master', async () => {
    sendImpl = async () => { throw httpError(404) }
    gameMaster = 'user-2'
    const { updateScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await expect(updateScene(GAME, { id: 'sc-1', name: 'New' }, {})).rejects.toMatchObject({ kind: 'notMaster' })
  })
})

describe('deleteScene', () => {
  async function withLiveScene() {
    const ctx = await load()
    const scene = { id: 'sc-1', name: 'Crypt', image: 'image.jpg', sound: null }
    ctx.media.put('scenes', GAME, scene)
    const { withScene } = await import('@/domain/stage')
    ctx.stages.set(withScene(ctx.stages.stageOf(GAME), scene))
    return ctx
  }

  it('publishes the stage without the live scene first, then deletes', async () => {
    const { deleteScene, media, stages } = await withLiveScene()
    await deleteScene(GAME, 'sc-1')
    const order = calls.filter(c => (c.collection === 'stages' && c.method === 'update')
      || (c.collection === 'scenes' && c.method === 'delete')).map(c => c.collection)
    expect(order).toEqual(['stages', 'scenes'])
    expect((stagePublishes()[0]!.args[1] as { data: { scene: unknown } }).data.scene).toBeNull()
    expect(stages.stageOf(GAME).scene).toBeNull()
    expect(media.scenes.list).toEqual([])
  })

  it('does not delete when the publish fails', async () => {
    stageUpdateImpl = async () => { throw httpError(500) }
    const { deleteScene, media, stages } = await withLiveScene()
    await expect(deleteScene(GAME, 'sc-1')).rejects.toMatchObject({ status: 500 })
    expect(sceneDeletes()).toHaveLength(0)
    expect(media.scenes.list).toHaveLength(1)
    expect(stages.stageOf(GAME).scene?.id).toBe('sc-1')
  })

  it('does not publish for a scene that is not live', async () => {
    const { deleteScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await deleteScene(GAME, 'sc-2')
    expect(stagePublishes()).toHaveLength(0)
    expect(sceneDeletes()).toHaveLength(1)
    expect(media.scenes.list).toEqual([])
  })

  it('counts a 404 as done while the user is still the master', async () => {
    deleteImpl = async () => { throw httpError(404) }
    const { deleteScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await deleteScene(GAME, 'sc-2')
    expect(media.scenes.list).toEqual([])
  })

  it('raises notMaster on a 404 when the master has changed', async () => {
    deleteImpl = async () => { throw httpError(404) }
    gameMaster = 'user-2'
    const { deleteScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await expect(deleteScene(GAME, 'sc-2')).rejects.toMatchObject({ kind: 'notMaster' })
  })
})

describe('writes that outlive their game or session', () => {
  const live = { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' }

  async function liveContext() {
    const ctx = await load()
    ctx.media.put('scenes', GAME, live)
    const { withScene } = await import('@/domain/stage')
    ctx.stages.set(withScene(ctx.stages.stageOf(GAME), live))
    return ctx
  }

  it('update: a store cleared mid-upload stays cleared and nothing is published', async () => {
    const gate = deferred()
    sendImpl = () => gate.promise
    const { updateScene, media } = await liveContext()
    const done = updateScene(GAME, { id: 'sc-1', name: 'New' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    media.clearAll()
    gate.resolve(row('sc-1', { image: 'image.jpg', sound: 'sound_new.mp3' }))
    await done
    expect(media.scenes.list).toEqual([])
    expect(stagePublishes()).toHaveLength(0)
  })

  it('update: a session that ended mid-upload publishes nothing', async () => {
    const gate = deferred()
    sendImpl = () => gate.promise
    const { updateScene } = await liveContext()
    const done = updateScene(GAME, { id: 'sc-1', name: 'New' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    stays = false
    gate.resolve(row('sc-1', { image: 'image.jpg', sound: 'sound_new.mp3' }))
    await done
    expect(stagePublishes()).toHaveLength(0)
  })

  it('update: a store switched to another game publishes nothing and keeps the other list', async () => {
    const gate = deferred()
    sendImpl = () => gate.promise
    const { updateScene, media } = await liveContext()
    const done = updateScene(GAME, { id: 'sc-1', name: 'New' }, { sound: file('a.mp3', 'audio/mpeg') })
    await flush()
    media.startLoading('game-2', ['scenes', 'sounds'])
    gate.resolve(row('sc-1', { image: 'image.jpg', sound: 'sound_new.mp3' }))
    await done
    expect(media.scenes.list).toEqual([])
    expect(stagePublishes()).toHaveLength(0)
  })

  it('delete: a store cleared while the table is being updated deletes nothing', async () => {
    const gate = deferred()
    stageUpdateImpl = () => gate.promise
    const { deleteScene, media } = await liveContext()
    const done = deleteScene(GAME, 'sc-1')
    await flush()
    media.clearAll()
    gate.resolve({})
    await expect(done).rejects.toMatchObject({ kind: 'aborted' })
    expect(sceneDeletes()).toHaveLength(0)
    expect(media.scenes.list).toEqual([])
  })

  it('delete: a session that ended while the table is being updated deletes nothing', async () => {
    const gate = deferred()
    stageUpdateImpl = () => gate.promise
    const { deleteScene } = await liveContext()
    const done = deleteScene(GAME, 'sc-1')
    await flush()
    stays = false
    gate.resolve({})
    await expect(done).rejects.toMatchObject({ kind: 'aborted' })
    expect(sceneDeletes()).toHaveLength(0)
  })

  it('delete: a store cleared during the delete request stays cleared', async () => {
    const gate = deferred()
    deleteImpl = () => gate.promise
    const { deleteScene, media } = await load()
    media.put('scenes', GAME, { id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    const done = deleteScene(GAME, 'sc-2')
    await flush()
    media.clearAll()
    media.startLoading('game-2', ['scenes', 'sounds'])
    media.put('scenes', 'game-2', { id: 'sc-2', name: 'Same id elsewhere', image: null, sound: 'sound.mp3' })
    gate.resolve(true)
    await done
    expect(media.scenes.list).toHaveLength(1)
  })
})

describe('the live scene after an update', () => {
  const live = { id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' }

  async function liveContext() {
    const ctx = await load()
    ctx.media.put('scenes', GAME, live)
    const { withScene } = await import('@/domain/stage')
    ctx.stages.set(withScene(ctx.stages.stageOf(GAME), live))
    return ctx
  }

  it('publishes nothing for a rename that leaves the stored files as they are', async () => {
    sendImpl = async () => row('sc-1', { image: 'image.jpg', sound: 'sound.mp3', data: { id: 'sc-1', name: 'New' } })
    const { updateScene, media } = await liveContext()
    const saved = await updateScene(GAME, { id: 'sc-1', name: 'New' }, {})
    expect(saved.name).toBe('New')
    expect(media.scenes.list[0]!.name).toBe('New')
    expect(stagePublishes()).toHaveLength(0)
  })

  it('reports a failed publish as stagePublishFailed with the saved scene, and republishScene retries it', async () => {
    sendImpl = async () => row('sc-1', { image: 'image_new.jpg', sound: 'sound.mp3' })
    stageUpdateImpl = async () => { throw httpError(500) }
    const { updateScene, republishScene, media } = await liveContext()
    const err = await updateScene(GAME, { id: 'sc-1', name: 'Old' }, { image: file('x.jpg', 'image/jpeg') }).catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'stagePublishFailed', saved: { id: 'sc-1', image: 'image_new.jpg' } })
    expect(media.scenes.list[0]!.image).toBe('image_new.jpg')
    stageUpdateImpl = async () => ({})
    await republishScene(GAME, (err as { saved: Scene }).saved)
    const last = stagePublishes().at(-1)!
    expect((last.args[1] as { data: { scene: { image: { name: string } } } }).data.scene.image.name).toBe('image_new.jpg')
  })

  it('republishScene does nothing for a scene that is no longer the live one', async () => {
    const { republishScene } = await load()
    await republishScene(GAME, live)
    expect(stagePublishes()).toHaveLength(0)
  })

  it('does not report a publish dropped by a session that ended', async () => {
    sendImpl = async () => { stays = false; return row('sc-1', { image: 'image_new.jpg', sound: 'sound.mp3' }) }
    const { updateScene } = await liveContext()
    await expect(updateScene(GAME, { id: 'sc-1', name: 'Old' }, { image: file('x.jpg', 'image/jpeg') })).resolves.toBeTruthy()
  })
})

describe('openMedia', () => {
  it('shares a load already in flight instead of listing and subscribing again', async () => {
    const { openMedia } = await load()
    await Promise.all([openMedia(GAME), openMedia(GAME)])
    for (const collection of ['scenes', 'sounds']) {
      expect(calls.filter(c => c.collection === collection && c.method === 'getFullList')).toHaveLength(1)
      expect(calls.filter(c => c.collection === collection && c.method === 'subscribe')).toHaveLength(1)
    }
  })

  it('stops listening when the load fails', async () => {
    const { openMedia, media } = await load()
    listFails = true
    await openMedia(GAME)
    expect(media.scenes.status).toBe('failed')
    expect(calls.filter(c => c.method === 'unsubscribe').length).toBeGreaterThan(0)
  })
})

describe('several kinds', () => {
  it('a failed load of one kind fails only its slot', async () => {
    const { openMedia, media } = await load()
    listRows = [row('a', { image: 'image.webp' })]
    soundsListFails = true
    await openMedia(GAME)
    expect(media.scenes.status).toBe('ready')
    expect(media.scenes.list.map(s => s.id)).toEqual(['a'])
    expect(media.sounds.status).toBe('failed')
    expect(calls.filter(c => c.collection === 'sounds' && c.method === 'unsubscribe')).toHaveLength(1)
    expect(calls.filter(c => c.collection === 'scenes' && c.method === 'unsubscribe')).toHaveLength(0)
  })

  it('a failed load of scenes leaves the sounds slot ready', async () => {
    const { openMedia, media } = await load()
    listFails = true
    soundRows = [soundRow('s1')]
    await openMedia(GAME)
    expect(media.scenes.status).toBe('failed')
    expect(media.sounds.status).toBe('ready')
    expect(media.sounds.list.map(x => x.id)).toEqual(['s1'])
    expect(calls.filter(c => c.collection === 'scenes' && c.method === 'unsubscribe')).toHaveLength(1)
    expect(calls.filter(c => c.collection === 'sounds' && c.method === 'unsubscribe')).toHaveLength(0)
  })

  it('a late write for one kind cannot touch another kind or another game', async () => {
    const { createSound, media } = await load()
    media.put('scenes', GAME, { id: 'same', name: 'Scene', image: null, sound: 'sound.mp3' })
    media.put('sounds', GAME, { id: 'same', name: 'Sound', loop: false, duration: null, file: 'sound.mp3' })
    media.remove('sounds', GAME, 'same')
    expect(media.scenes.list.map(s => s.id)).toEqual(['same'])
    expect(media.sounds.list).toEqual([])

    const late = deferred()
    sendImpl = async () => { await late.promise; return soundRow('snd-1') }
    const pending = createSound(GAME, { id: 'snd-1', name: 'Rain', loop: true, duration: 12 }, file('a.mp3', 'audio/mpeg'))
    await flush()
    media.clearAll()
    media.startLoading('game-2', ['scenes', 'sounds'])
    media.put('scenes', 'game-2', { id: 'other', name: 'Other', image: null, sound: 'sound.mp3' })
    late.resolve()
    await pending
    expect(media.sounds.list).toEqual([])
    expect(media.scenes.list.map(s => s.id)).toEqual(['other'])
    expect(sent[0]!.path).toBe('/api/collections/sounds/records')
  })
})

describe('sounds', () => {
  const draft = { id: 'snd-1', name: ' Rain ', loop: true, duration: 12.5 }
  const playingSound: Sound = { id: 'snd-1', name: 'Rain', loop: true, duration: 12.5, file: 'sound.mp3' }

  it('lists the game, maps a row to a Sound and drops one that fails the shape check', async () => {
    soundRows = [
      soundRow('a'),
      soundRow('b', { data: { id: 'other', name: 'Wrong id', loop: false } }),
      soundRow('c', { data: { id: 'c', name: 'No loop' } }),
      soundRow('d', { data: { id: 'd', name: 'Bell', loop: true } }),
      soundRow('e', { file: '' }),
    ]
    const { openMedia, media } = await load()
    await openMedia(GAME)
    expect(media.sounds.status).toBe('ready')
    expect(media.sounds.list).toEqual<Sound[]>([
      { id: 'a', name: 'Sound a', loop: false, duration: 12, file: 'sound.mp3' },
      { id: 'd', name: 'Bell', loop: true, duration: null, file: 'sound.mp3' },
    ])
    expect(calls.filter(c => c.collection === 'sounds' && c.method === 'subscribe')).toHaveLength(1)
  })

  it('create uploads the file as sound.<ext> with the data carrying name, loop and duration', async () => {
    sendImpl = async s => soundRow(String(s.form.get('id')), { data: JSON.parse(String(s.form.get('data'))) })
    const { createSound, media } = await load()
    const sound = await createSound(GAME, draft, file('My Track (1).MP3', 'audio/mpeg'))
    const { method, path, form } = sent[0]!
    expect(method).toBe('POST')
    expect(path).toBe('/api/collections/sounds/records')
    expect(form.get('id')).toBe('snd-1')
    expect(form.get('game')).toBe(GAME)
    expect(JSON.parse(String(form.get('data')))).toEqual({ id: 'snd-1', name: 'Rain', loop: true, duration: 12.5 })
    expect((form.get('file') as File).name).toBe('sound.mp3')
    expect(sound).toEqual(playingSound)
    expect(media.sounds.list).toEqual([playingSound])
  })

  it('create leaves an unknown duration out of the data', async () => {
    sendImpl = async s => soundRow(String(s.form.get('id')))
    const { createSound } = await load()
    await createSound(GAME, { ...draft, duration: null }, file('a.m4a', 'audio/mp4'))
    expect(JSON.parse(String(sent[0]!.form.get('data')))).toEqual({ id: 'snd-1', name: 'Rain', loop: true })
    expect((sent[0]!.form.get('file') as File).name).toBe('sound.m4a')
  })

  it('create refuses a draft without a name before any request', async () => {
    const { createSound } = await load()
    await expect(createSound(GAME, { ...draft, name: ' ' }, file('a.mp3', 'audio/mpeg'))).rejects.toThrow(/invalid sounds entry/)
    expect(sent).toHaveLength(0)
  })

  it('the 16th sound is limitReached before any request', async () => {
    const { createSound, media } = await load()
    for (let i = 0; i < 15; i++) media.put('sounds', GAME, { id: `s${i}`, name: `S${i}`, loop: false, duration: null, file: 'sound.mp3' })
    await expect(createSound(GAME, draft, file('a.mp3', 'audio/mpeg'))).rejects.toMatchObject({ kind: 'limitReached' })
    expect(sent).toHaveLength(0)
  })

  it('update sends data only, and publishes nothing even when that sound is playing', async () => {
    sendImpl = async s => soundRow('snd-1', { data: JSON.parse(String(s.form.get('data'))) })
    const { updateSound, media, stages } = await load()
    media.put('sounds', GAME, playingSound)
    const { withSound } = await import('@/domain/stage')
    stages.set(withSound(stages.stageOf(GAME), playingSound, '2026-11-12T10:00:00.000Z'))
    const saved = await updateSound(GAME, { ...draft, name: 'Heavy rain', loop: false })
    const { method, path, form } = sent[0]!
    expect(method).toBe('PATCH')
    expect(path).toBe('/api/collections/sounds/records/snd-1')
    expect([...form.keys()].sort()).toEqual(['data'])
    expect(saved).toMatchObject({ name: 'Heavy rain', loop: false })
    expect(media.sounds.list[0]).toMatchObject({ name: 'Heavy rain', loop: false })
    expect(stagePublishes()).toHaveLength(0)
    expect(stages.stageOf(GAME).sound?.startedAt).toBe('2026-11-12T10:00:00.000Z')
  })

  it('deleting the playing sound publishes the stage without it first, then deletes', async () => {
    const { deleteSound, media, stages } = await load()
    media.put('sounds', GAME, playingSound)
    const { withSound } = await import('@/domain/stage')
    stages.set(withSound(stages.stageOf(GAME), playingSound, '2026-11-12T10:00:00.000Z'))
    await deleteSound(GAME, 'snd-1')
    const order = calls.filter(c => (c.collection === 'stages' && c.method === 'update')
      || (c.collection === 'sounds' && c.method === 'delete')).map(c => c.collection)
    expect(order).toEqual(['stages', 'sounds'])
    expect((stagePublishes()[0]!.args[1] as { data: { sound: unknown } }).data.sound).toBeNull()
    expect(stages.stageOf(GAME).sound).toBeNull()
    expect(media.sounds.list).toEqual([])
  })

  it('does not delete the playing sound when taking it off the table fails', async () => {
    stageUpdateImpl = async () => { throw httpError(500) }
    const { deleteSound, media, stages } = await load()
    media.put('sounds', GAME, playingSound)
    const { withSound } = await import('@/domain/stage')
    stages.set(withSound(stages.stageOf(GAME), playingSound, '2026-11-12T10:00:00.000Z'))
    await expect(deleteSound(GAME, 'snd-1')).rejects.toMatchObject({ status: 500 })
    expect(soundDeletes()).toHaveLength(0)
    expect(media.sounds.list).toHaveLength(1)
    expect(stages.stageOf(GAME).sound?.id).toBe('snd-1')
  })

  it('deleting a sound that is not playing publishes nothing', async () => {
    const { deleteSound, media } = await load()
    media.put('sounds', GAME, playingSound)
    await deleteSound(GAME, 'snd-1')
    expect(stagePublishes()).toHaveLength(0)
    expect(soundDeletes()).toHaveLength(1)
  })

  it('a row without a file is not in the store, so no empty file name can be published', async () => {
    soundRows = [soundRow('a', { file: '' }), soundRow('b')]
    const { openMedia, media } = await load()
    await openMedia(GAME)
    expect(media.sounds.list.map(s => s.id)).toEqual(['b'])
    expect(media.sounds.list.every(s => s.file !== '')).toBe(true)
  })

  const soundFileBody = (code: string) => JSON.stringify({
    data: { file: { code, message: 'refused' } }, message: 'Failed to create record.', status: 400,
  })

  it('maps a refused file on create and update to fileRefused on the file field', async () => {
    const { createSound, updateSound, media } = await load()
    sendImpl = async () => { throw errorFromResponse('', 400, soundFileBody('validation_invalid_mime_type')) }
    await expect(createSound(GAME, draft, file('a.mp3', 'audio/mpeg')))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'file', reason: 'type' })
    sendImpl = async () => { throw errorFromResponse('', 400, soundFileBody('validation_file_size_limit')) }
    media.put('sounds', GAME, playingSound)
    await expect(updateSound(GAME, draft)).rejects.toMatchObject({ kind: 'fileRefused', field: 'file', reason: 'size' })
  })

  it('a 400 without a file code looks the sound up by id and returns it when it exists', async () => {
    sendImpl = async () => { throw recorded('createDuplicateId') }
    soundGetImpl = async () => soundRow('snd-1', { data: { id: 'snd-1', name: 'Rain', loop: true, duration: 12.5 } })
    const { createSound, media } = await load()
    const sound = await createSound(GAME, draft, file('a.mp3', 'audio/mpeg'))
    expect(sound.id).toBe('snd-1')
    expect(media.sounds.list.map(s => s.id)).toEqual(['snd-1'])
    expect(calls.some(c => c.collection === 'sounds' && c.method === 'getOne' && c.args[0] === 'snd-1')).toBe(true)
  })

  it('a 404 on update or delete re-reads the game', async () => {
    gameMaster = 'user-2'
    const { updateSound, deleteSound, media } = await load()
    media.put('sounds', GAME, playingSound)
    sendImpl = async () => { throw recorded('updateNotFound') }
    await expect(updateSound(GAME, draft)).rejects.toMatchObject({ kind: 'notMaster' })
    deleteImpl = async () => { throw httpError(404) }
    await expect(deleteSound(GAME, 'snd-1')).rejects.toMatchObject({ kind: 'notMaster' })
    expect(calls.filter(c => c.collection === 'games' && c.method === 'getOne')).toHaveLength(2)
  })
})

describe('images', () => {
  const draft = { id: 'img-1', caption: ' A map ' }
  const IMG: TableImage = { id: 'img-1', caption: 'A map', file: 'image.jpg' }
  const SHOWN_AT = '2026-11-12T10:00:00.000Z'

  async function shown(withCaption: boolean, image: TableImage = IMG) {
    const ctx = await load()
    ctx.media.put('images', GAME, image)
    const { withImage } = await import('@/domain/stage')
    ctx.stages.set(withImage(ctx.stages.stageOf(GAME), image, withCaption, SHOWN_AT))
    return ctx
  }
  const lastStageImage = () => (stagePublishes().at(-1)!.args[1] as { data: { image: { file: { name: string }; caption: string | null; shownAt: string } } }).data.image

  it('lists the game, maps a row to a TableImage and drops one that fails the shape check', async () => {
    imageRows = [
      imageRow('a', { data: { id: 'a', caption: '  Trimmed  ' } }),
      imageRow('b', { data: { id: 'other', caption: 'Wrong id' } }),
      imageRow('c', { data: { id: 'c' } }),
      imageRow('d', { data: { id: 'd', caption: '   ' } }),
      imageRow('e', { data: { id: 'e', caption: 'x'.repeat(121) } }),
      imageRow('f', { file: '' }),
    ]
    const { openMedia, media } = await load()
    await openMedia(GAME)
    expect(media.images.status).toBe('ready')
    expect(media.images.list).toEqual<TableImage[]>([
      { id: 'a', caption: 'Trimmed', file: 'image.jpg' },
      { id: 'c', caption: null, file: 'image.jpg' },
      { id: 'd', caption: null, file: 'image.jpg' },
    ])
    expect(calls.filter(c => c.collection === 'images' && c.method === 'subscribe')).toHaveLength(1)
  })

  it('create uploads under image.<ext> with the trimmed caption in the data', async () => {
    sendImpl = async s => imageRow(String(s.form.get('id')), { data: JSON.parse(String(s.form.get('data'))) })
    const { createImage, media } = await load()
    const image = await createImage(GAME, draft, file('Holiday (1).PNG', 'image/png'))
    const { method, path, form } = sent[0]!
    expect(method).toBe('POST')
    expect(path).toBe('/api/collections/images/records')
    expect(form.get('game')).toBe(GAME)
    expect(JSON.parse(String(form.get('data')))).toEqual({ id: 'img-1', caption: 'A map' })
    expect((form.get('file') as File).name).toBe('image.png')
    expect(image).toEqual(IMG)
    expect(media.images.list).toEqual([IMG])
  })

  it('create fits the image first and uploads the fitted file under its neutral name', async () => {
    const big = file('huge.bmp', 'image/bmp')
    fitImpl = async () => file('whatever.webp', 'image/webp')
    sendImpl = async s => imageRow(String(s.form.get('id')))
    const { createImage } = await load()
    const { IMAGE_MAX_BYTES } = await import('@/domain/stage')
    await createImage(GAME, { id: 'img-1', caption: null }, big)
    expect(fitCalls).toEqual([[big, IMAGE_MAX_BYTES]])
    expect((sent[0]!.form.get('file') as File).name).toBe('image.webp')
  })

  it('create refuses a caption that is too long before any request', async () => {
    const { createImage } = await load()
    await expect(createImage(GAME, { id: 'img-1', caption: 'x'.repeat(121) }, file('a.png', 'image/png'))).rejects.toThrow(/invalid images entry/)
    expect(sent).toHaveLength(0)
  })

  it('the 31st image is limitReached before any request', async () => {
    const { createImage, media } = await load()
    for (let i = 0; i < 30; i++) media.put('images', GAME, { id: `i${i}`, caption: null, file: 'image.jpg' })
    await expect(createImage(GAME, draft, file('a.png', 'image/png'))).rejects.toMatchObject({ kind: 'limitReached' })
    expect(sent).toHaveLength(0)
  })

  it('saving the shown image with a new file re-publishes it with the new file, the same shownAt and the new caption', async () => {
    sendImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: 'Better map' }, file: 'image_new.png' })
    const { updateImage, stages } = await shown(true)
    await updateImage(GAME, { id: 'img-1', caption: 'Better map' }, file('b.png', 'image/png'))
    expect(stagePublishes()).toHaveLength(1)
    expect(lastStageImage()).toEqual({
      id: 'img-1', file: { collection: 'images', record: 'img-1', name: 'image_new.png' }, caption: 'Better map', shownAt: SHOWN_AT,
    })
    expect(stages.stageOf(GAME).image?.shownAt).toBe(SHOWN_AT)
  })

  it('saving the image shown without a caption never puts the caption on the stage', async () => {
    sendImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: 'Secret words' }, file: 'image_new.png' })
    const { updateImage } = await shown(false)
    await updateImage(GAME, { id: 'img-1', caption: 'Secret words' }, file('b.png', 'image/png'))
    expect(lastStageImage()).toMatchObject({ file: { name: 'image_new.png' }, caption: null, shownAt: SHOWN_AT })
    expect(JSON.stringify(stagePublishes().at(-1)!.args)).not.toContain('Secret words')
  })

  it('removing the caption of an image shown with its caption takes the caption off the stage', async () => {
    sendImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: null } })
    const { updateImage, stages } = await shown(true)
    await updateImage(GAME, { id: 'img-1', caption: null })
    expect(stagePublishes()).toHaveLength(1)
    expect(lastStageImage()).toEqual({
      id: 'img-1', file: { collection: 'images', record: 'img-1', name: 'image.jpg' }, caption: null, shownAt: SHOWN_AT,
    })
    expect(stages.stageOf(GAME).image?.caption).toBeNull()
  })

  it('a caption-only edit of an image shown with its caption publishes the new caption, the same file and shownAt', async () => {
    sendImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: 'The old mill' } })
    const { updateImage, stages } = await shown(true)
    await updateImage(GAME, { id: 'img-1', caption: 'The old mill' })
    expect(sent[0]!.form.has('file')).toBe(false)
    expect(stagePublishes()).toHaveLength(1)
    expect(lastStageImage()).toEqual({
      id: 'img-1', file: { collection: 'images', record: 'img-1', name: 'image.jpg' }, caption: 'The old mill', shownAt: SHOWN_AT,
    })
    expect(stages.stageOf(GAME).image).toMatchObject({ caption: 'The old mill', shownAt: SHOWN_AT })
  })

  it('saving an image that is not shown writes no stage', async () => {
    sendImpl = async () => imageRow('img-1', { file: 'image_new.png' })
    const { updateImage, media } = await load()
    media.put('images', GAME, IMG)
    await updateImage(GAME, { id: 'img-1', caption: 'A map' }, file('b.png', 'image/png'))
    expect(stagePublishes()).toHaveLength(0)
    expect(media.images.list[0]!.file).toBe('image_new.png')
  })

  it('a save that changes nothing the stage shows writes no stage', async () => {
    sendImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: 'New words' } })
    const { updateImage, media } = await shown(false)
    const saved = await updateImage(GAME, { id: 'img-1', caption: 'New words' })
    expect(saved.caption).toBe('New words')
    expect(media.images.list[0]!.caption).toBe('New words')
    expect(stagePublishes()).toHaveLength(0)
  })

  it('update without a file sends the data only', async () => {
    sendImpl = async () => imageRow('img-1')
    const { updateImage, media } = await load()
    media.put('images', GAME, IMG)
    await updateImage(GAME, { id: 'img-1', caption: null })
    expect([...sent[0]!.form.keys()]).toEqual(['data'])
    expect(sent[0]!.path).toBe('/api/collections/images/records/img-1')
  })

  it('a failed publish after a save is stagePublishFailed with the saved image, and republishImage retries it', async () => {
    sendImpl = async () => imageRow('img-1', { file: 'image_new.png' })
    stageUpdateImpl = async () => { throw httpError(500) }
    const { updateImage, republishImage, media } = await shown(true)
    const err = await updateImage(GAME, { id: 'img-1', caption: 'A map' }, file('b.png', 'image/png')).catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'stagePublishFailed', saved: { id: 'img-1', file: 'image_new.png' } })
    expect(media.images.list[0]!.file).toBe('image_new.png')
    stageUpdateImpl = async () => ({})
    await republishImage(GAME, (err as { saved: TableImage }).saved)
    expect(lastStageImage()).toMatchObject({ file: { name: 'image_new.png' }, shownAt: SHOWN_AT })
  })

  it('deleting the shown image publishes the stage without it first, then deletes', async () => {
    const { deleteImage, media, stages } = await shown(true)
    await deleteImage(GAME, 'img-1')
    const order = calls.filter(c => (c.collection === 'stages' && c.method === 'update')
      || (c.collection === 'images' && c.method === 'delete')).map(c => c.collection)
    expect(order).toEqual(['stages', 'images'])
    expect((stagePublishes()[0]!.args[1] as { data: { image: unknown } }).data.image).toBeNull()
    expect(stages.stageOf(GAME).image).toBeNull()
    expect(media.images.list).toEqual([])
  })

  it('does not delete the shown image when taking it off the table fails', async () => {
    stageUpdateImpl = async () => { throw httpError(500) }
    const { deleteImage, media, stages } = await shown(true)
    await expect(deleteImage(GAME, 'img-1')).rejects.toMatchObject({ status: 500 })
    expect(imageDeletes()).toHaveLength(0)
    expect(media.images.list).toHaveLength(1)
    expect(stages.stageOf(GAME).image?.id).toBe('img-1')
  })

  it('deleting an image that is not shown publishes nothing', async () => {
    const { deleteImage, media } = await load()
    media.put('images', GAME, IMG)
    await deleteImage(GAME, 'img-1')
    expect(stagePublishes()).toHaveLength(0)
    expect(imageDeletes()).toHaveLength(1)
  })

  const imageFileBody = (code: string) => JSON.stringify({
    data: { file: { code, message: 'refused' } }, message: 'Failed to create record.', status: 400,
  })

  it('maps a refused file on create and update to fileRefused on the file field', async () => {
    const { createImage, updateImage, media } = await load()
    sendImpl = async () => { throw errorFromResponse('', 400, imageFileBody('validation_invalid_mime_type')) }
    await expect(createImage(GAME, draft, file('a.png', 'image/png')))
      .rejects.toMatchObject({ kind: 'fileRefused', field: 'file', reason: 'type' })
    sendImpl = async () => { throw errorFromResponse('', 400, imageFileBody('validation_file_size_limit')) }
    media.put('images', GAME, IMG)
    await expect(updateImage(GAME, draft, file('a.png', 'image/png'))).rejects.toMatchObject({ kind: 'fileRefused', field: 'file', reason: 'size' })
  })

  it('a 400 without a file code looks the image up by id and returns it when it exists', async () => {
    sendImpl = async () => { throw recorded('createDuplicateId') }
    imageGetImpl = async () => imageRow('img-1', { data: { id: 'img-1', caption: 'A map' } })
    const { createImage, media } = await load()
    const image = await createImage(GAME, draft, file('a.png', 'image/png'))
    expect(image.id).toBe('img-1')
    expect(media.images.list.map(i => i.id)).toEqual(['img-1'])
    expect(calls.some(c => c.collection === 'images' && c.method === 'getOne' && c.args[0] === 'img-1')).toBe(true)
  })

  it('a 404 on update or delete re-reads the game', async () => {
    gameMaster = 'user-2'
    const { updateImage, deleteImage, media } = await load()
    media.put('images', GAME, IMG)
    sendImpl = async () => { throw recorded('updateNotFound') }
    await expect(updateImage(GAME, draft)).rejects.toMatchObject({ kind: 'notMaster' })
    deleteImpl = async () => { throw httpError(404) }
    await expect(deleteImage(GAME, 'img-1')).rejects.toMatchObject({ kind: 'notMaster' })
    expect(calls.filter(c => c.collection === 'games' && c.method === 'getOne')).toHaveLength(2)
  })

  it('a late answer for an image cannot touch another kind or another game', async () => {
    const { createImage, media } = await load()
    media.put('sounds', GAME, { id: 'same', name: 'Sound', loop: false, duration: null, file: 'sound.mp3' })
    media.put('images', GAME, { id: 'same', caption: null, file: 'image.jpg' })
    media.remove('images', GAME, 'same')
    expect(media.sounds.list.map(x => x.id)).toEqual(['same'])
    expect(media.images.list).toEqual([])

    const late = deferred()
    sendImpl = async () => { await late.promise; return imageRow('img-1') }
    const pending = createImage(GAME, draft, file('a.png', 'image/png'))
    await flush()
    media.clearAll()
    media.startLoading('game-2', ['scenes', 'sounds', 'images'])
    media.put('sounds', 'game-2', { id: 'other', name: 'Other', loop: false, duration: null, file: 'sound.mp3' })
    late.resolve()
    await pending
    expect(media.images.list).toEqual([])
    expect(media.sounds.list.map(x => x.id)).toEqual(['other'])
  })
})
