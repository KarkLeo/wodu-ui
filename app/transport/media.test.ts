import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Scene } from '@/types/stage'
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
let sceneGetImpl: (id: string) => Promise<unknown>

vi.mock('@/transport/pb', () => ({
  pb: {
    filter: (raw: string) => raw,
    collection: (collection: string) => new Proxy({}, {
      get: (_t, method: string) => (...args: unknown[]) => {
        calls.push({ collection, method, args })
        if (collection === 'stages' && method === 'update') return stageUpdateImpl()
        if (collection === 'scenes' && method === 'delete') return deleteImpl()
        if (collection === 'scenes' && method === 'getFullList') return listFails ? Promise.reject(new Error('refused')) : Promise.resolve(listRows)
        if (collection === 'sounds' && method === 'getFullList') return soundsListFails ? Promise.reject(new Error('refused')) : Promise.resolve([])
        if (collection === 'scenes' && method === 'getOne') return sceneGetImpl(String(args[0]))
        if (collection === 'games' && method === 'getOne') {
          return Promise.resolve({ id: 'game-1', name: 'G', master: gameMaster, invite_code: 'ABCD2345' })
        }
        return Promise.resolve(method === 'subscribe' ? () => Promise.resolve() : {})
      },
    }),
  },
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
  media.startLoading(GAME)
  return { ...transport, media, stages: useStageStore() }
}

const stagePublishes = () => calls.filter(c => c.collection === 'stages' && c.method === 'update')
const sceneDeletes = () => calls.filter(c => c.collection === 'scenes' && c.method === 'delete')

beforeEach(() => {
  calls.length = 0
  sent.length = 0
  stays = true
  gameMaster = 'user-1'
  listRows = []
  listFails = false
  soundsListFails = false
  sceneGetImpl = async () => { throw httpError(404) }
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
    expect(calls.filter(c => c.method === 'subscribe')).toHaveLength(1)
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
    media.startLoading('game-2')
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
    media.startLoading('game-2')
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
    media.startLoading('game-2')
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
    expect(calls.filter(c => c.method === 'getFullList')).toHaveLength(1)
    expect(calls.filter(c => c.method === 'subscribe')).toHaveLength(1)
  })

  it('stops listening when the load fails', async () => {
    const { openMedia, media } = await load()
    listFails = true
    await openMedia(GAME)
    expect(media.scenes.status).toBe('failed')
    expect(calls.filter(c => c.method === 'unsubscribe').length).toBeGreaterThan(0)
  })
})

// A second kind, registered only here: the production table wires scenes alone for now.
function wireSounds(mediaKinds: Record<string, unknown>) {
  mediaKinds.sounds = {
    collection: 'sounds',
    files: [{ name: 'file', kind: 'audio', required: true }],
    limit: 15,
    fromRow: (r: { id: string }) => ({ id: r.id }),
    checkDraft: (d: { id: string }) => ({ id: d.id }),
    stored: () => ({ file: null }),
  }
}

describe('several kinds', () => {
  it('a failed load of one kind fails only its slot', async () => {
    const { openMedia, mediaKinds, media } = await load()
    wireSounds(mediaKinds)
    listRows = [row('a', { image: 'image.webp' })]
    soundsListFails = true
    await openMedia(GAME)
    expect(media.scenes.status).toBe('ready')
    expect(media.scenes.list.map(s => s.id)).toEqual(['a'])
    expect(media.sounds.status).toBe('failed')
    expect(calls.filter(c => c.collection === 'sounds' && c.method === 'unsubscribe')).toHaveLength(1)
    expect(calls.filter(c => c.collection === 'scenes' && c.method === 'unsubscribe')).toHaveLength(0)
  })

  it('a late write for one kind cannot touch another kind or another game', async () => {
    const { createMedia, mediaKinds, media } = await load()
    wireSounds(mediaKinds)
    media.put('scenes', GAME, { id: 'same', name: 'Scene', image: null, sound: 'sound.mp3' })
    media.put('sounds', GAME, { id: 'same', name: 'Sound', loop: false, duration: null, file: 'sound.mp3' })
    media.remove('sounds', GAME, 'same')
    expect(media.scenes.list.map(s => s.id)).toEqual(['same'])
    expect(media.sounds.list).toEqual([])

    const late = deferred()
    sendImpl = async () => { await late.promise; return { id: 'snd-1', game: GAME, data: { id: 'snd-1' }, file: 'file.mp3' } }
    const pending = createMedia('sounds', GAME, { id: 'snd-1' }, { file: file('a.mp3', 'audio/mpeg') })
    await flush()
    media.clearAll()
    media.startLoading('game-2')
    media.put('scenes', 'game-2', { id: 'other', name: 'Other', image: null, sound: 'sound.mp3' })
    late.resolve()
    await pending
    expect(media.sounds.list).toEqual([])
    expect(media.scenes.list.map(s => s.id)).toEqual(['other'])
    expect(sent[0]!.path).toBe('/api/collections/sounds/records')
  })
})
