import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Scene } from '@/types/stage'

interface Call { collection: string; method: string; args: unknown[] }
interface Sent { method: string; path: string; form: FormData }

const calls: Call[] = []
const sent: Sent[] = []
let stays = true
let sendImpl: (s: Sent) => Promise<unknown>
let stageUpdateImpl: () => Promise<unknown>
let deleteImpl: () => Promise<unknown>
let gameMaster = 'user-1'
let listRows: unknown[] = []

vi.mock('@/transport/pb', () => ({
  pb: {
    filter: (raw: string) => raw,
    collection: (collection: string) => new Proxy({}, {
      get: (_t, method: string) => (...args: unknown[]) => {
        calls.push({ collection, method, args })
        if (collection === 'stages' && method === 'update') return stageUpdateImpl()
        if (collection === 'scenes' && method === 'delete') return deleteImpl()
        if (collection === 'scenes' && method === 'getFullList') return Promise.resolve(listRows)
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
  sendForm: (method: string, path: string, form: FormData) => {
    const s = { method, path, form }
    sent.push(s)
    return sendImpl(s)
  },
}))

const GAME = 'game-1'
const httpError = (status: number) => Object.assign(new Error(`status ${status}`), { status })
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
  return { ...transport, media: useMediaStore(), stages: useStageStore() }
}

const stagePublishes = () => calls.filter(c => c.collection === 'stages' && c.method === 'update')
const sceneDeletes = () => calls.filter(c => c.collection === 'scenes' && c.method === 'delete')

beforeEach(() => {
  calls.length = 0
  sent.length = 0
  stays = true
  gameMaster = 'user-1'
  listRows = []
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
      { image: file('Моя картинка.JPG', 'image/jpeg'), sound: file('track (1).mp3', 'audio/mpeg') },
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
    sendImpl = async () => { throw httpError(400) }
    const { createScene } = await load()
    await expect(createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }))
      .rejects.toMatchObject({ kind: 'limitMayHaveChanged' })
  })

  it('lets a 400 at the limit through as it is', async () => {
    sendImpl = async () => { throw httpError(400) }
    const { createScene, media } = await load()
    const { MEDIA_LIMITS } = await import('@/domain/stage')
    for (let i = 0; i < MEDIA_LIMITS.scenes; i++) media.putScene({ id: `s${i}`, name: 'n', image: null, sound: 'sound.mp3' })
    const err = await createScene(GAME, { id: 'sc-1', name: 'X' }, { sound: file('a.mp3', 'audio/mpeg') }).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 400 })
    expect(err).not.toHaveProperty('kind')
  })
})

describe('updateScene', () => {
  it('sends a File as the file, null as an empty value and leaves undefined out', async () => {
    sendImpl = async () => row('sc-1', { image: 'image.png' })
    const { updateScene, media } = await load()
    media.putScene({ id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' })
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
    media.putScene({ id: 'sc-1', name: 'Old', image: 'image.jpg', sound: 'sound.mp3' })
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
    media.putScene({ id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await updateScene(GAME, { id: 'sc-1', name: 'New' }, {})
    expect(stagePublishes()).toHaveLength(0)
  })

  it('raises notMaster on a 404 when the game now has another master', async () => {
    sendImpl = async () => { throw httpError(404) }
    gameMaster = 'user-2'
    const { updateScene, media } = await load()
    media.putScene({ id: 'sc-1', name: 'Old', image: 'image.jpg', sound: null })
    await expect(updateScene(GAME, { id: 'sc-1', name: 'New' }, {})).rejects.toMatchObject({ kind: 'notMaster' })
  })
})

describe('deleteScene', () => {
  async function withLiveScene() {
    const ctx = await load()
    const scene = { id: 'sc-1', name: 'Crypt', image: 'image.jpg', sound: null }
    ctx.media.putScene(scene)
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
    media.putScene({ id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await deleteScene(GAME, 'sc-2')
    expect(stagePublishes()).toHaveLength(0)
    expect(sceneDeletes()).toHaveLength(1)
    expect(media.scenes.list).toEqual([])
  })

  it('counts a 404 as done while the user is still the master', async () => {
    deleteImpl = async () => { throw httpError(404) }
    const { deleteScene, media } = await load()
    media.putScene({ id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await deleteScene(GAME, 'sc-2')
    expect(media.scenes.list).toEqual([])
  })

  it('raises notMaster on a 404 when the master has changed', async () => {
    deleteImpl = async () => { throw httpError(404) }
    gameMaster = 'user-2'
    const { deleteScene, media } = await load()
    media.putScene({ id: 'sc-2', name: 'Other', image: null, sound: 'sound.mp3' })
    await expect(deleteScene(GAME, 'sc-2')).rejects.toMatchObject({ kind: 'notMaster' })
  })
})
