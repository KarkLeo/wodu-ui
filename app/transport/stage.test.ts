import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Stage } from '@/types/stage'

const updates: Array<{ id: string; body: { data: Stage } }> = []
const creates: Array<Record<string, unknown>> = []
let updateImpl: (id: string, body: { data: Stage }) => Promise<unknown>
let createImpl: (body: Record<string, unknown>) => Promise<unknown>
let stays = true
let reportThrows = false
const failures: Array<{ err: unknown; message: string }> = []

vi.mock('@/transport/pb', () => ({
  pb: {
    collection: () => ({
      update: (id: string, body: { data: Stage }) => {
        updates.push({ id, body })
        return updateImpl(id, body)
      },
      create: (body: Record<string, unknown>) => {
        creates.push(body)
        return createImpl(body)
      },
    }),
  },
}))
vi.mock('./onlineOps', () => ({
  call: <T>(op: () => Promise<T>) => op(),
  requireOnlineUser: () => 'user-1',
  staysCurrent: () => () => stays,
}))
vi.mock('./mode', () => ({ modeSession: () => 1 }))
vi.mock('./writeFailure', () => ({
  reportWriteFailure: (err: unknown, message: string) => {
    if (reportThrows) throw new Error('report failed')
    failures.push({ err, message })
  },
}))

const GAME = 'game-1'

function stage(soundId: string | null, gameId = GAME): Stage {
  return {
    id: gameId,
    scene: null,
    image: null,
    sound: soundId
      ? { id: soundId, file: { collection: 'sounds', record: soundId, name: 'a.mp3' }, loop: false, startedAt: '2026-01-01T00:00:00Z' }
      : null,
  }
}

function deferred() {
  let resolve!: (v?: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const httpError = (status: number) => Object.assign(new Error(`status ${status}`), { status })

async function load() {
  vi.resetModules()
  setActivePinia(createPinia())
  const transport = await import('./stage')
  const { useStageStore } = await import('@/stores/stage')
  const { useGamesStore } = await import('@/stores/games')
  useGamesStore().upsertGame({ id: GAME, name: 'G', master: 'user-1', inviteCode: 'ABCD2345' })
  return { ...transport, store: useStageStore() }
}

beforeEach(() => {
  updates.length = 0
  creates.length = 0
  failures.length = 0
  stays = true
  reportThrows = false
  updateImpl = async () => ({})
  createImpl = async () => ({})
})

describe('publishStage', () => {
  it('shows the stage before the write resolves', async () => {
    const gate = deferred()
    updateImpl = () => gate.promise
    const { publishStage, store } = await load()
    const done = publishStage(stage('s1'))
    expect(store.stageOf(GAME).sound?.id).toBe('s1')
    gate.resolve()
    await done
    expect(updates).toHaveLength(1)
    expect(updates[0]!.id).toBe(GAME)
  })

  it('creates the row when the update finds none', async () => {
    updateImpl = async () => { throw httpError(404) }
    const { publishStage } = await load()
    await publishStage(stage('s1'))
    expect(creates).toEqual([{ id: GAME, game: GAME, data: stage('s1') }])
  })

  it('retries as an update when the create is refused because the row exists', async () => {
    let n = 0
    updateImpl = async () => { if (n++ === 0) throw httpError(404) }
    createImpl = async () => { throw httpError(400) }
    const { publishStage } = await load()
    await publishStage(stage('s1'))
    expect(updates).toHaveLength(2)
    expect(creates).toHaveLength(1)
  })

  it('writes the first and the last of three publishes while the first is in flight, in order', async () => {
    const first = deferred()
    updateImpl = (_id, body) => (body.data.sound?.id === 's1' ? first.promise : Promise.resolve({}))
    const { publishStage, store } = await load()
    const a = publishStage(stage('s1'))
    const b = publishStage(stage('s2'))
    const c = publishStage(stage('s3'))
    expect(store.stageOf(GAME).sound?.id).toBe('s3')
    first.resolve()
    await Promise.all([a, b, c])
    expect(updates.map(u => u.body.data.sound?.id)).toEqual(['s1', 's3'])
  })

  it('restores the last confirmed stage, reports and rejects when the write fails', async () => {
    const { publishStage, store } = await load()
    await publishStage(stage('s1'))
    updateImpl = async () => { throw httpError(500) }
    await expect(publishStage(stage('s2'))).rejects.toMatchObject({ status: 500 })
    expect(store.stageOf(GAME).sound?.id).toBe('s1')
    expect(failures).toHaveLength(1)
    expect(failures[0]!.message).toContain('Could not change')
  })

  it('restores an empty stage when nothing was ever confirmed', async () => {
    updateImpl = async () => { throw httpError(500) }
    const { publishStage, store } = await load()
    await expect(publishStage(stage('s1'))).rejects.toBeTruthy()
    expect(store.stageOf(GAME).sound).toBeNull()
  })

  it('rejects with WriteDropped when the session ends before the write is sent', async () => {
    stays = false
    const { publishStage, WriteDropped } = await load()
    await expect(publishStage(stage('s1'))).rejects.toBeInstanceOf(WriteDropped)
    expect(updates).toHaveLength(0)
  })
})

describe('a failing cleanup', () => {
  it('still frees the key and settles the caller when the failure report throws', async () => {
    updateImpl = async () => { throw httpError(500) }
    reportThrows = true
    const { publishStage, receiveStage, store } = await load()
    await expect(publishStage(stage('s1'))).rejects.toMatchObject({ status: 500 })
    receiveStage('update', { id: GAME, game: GAME, data: stage('s9') })
    expect(store.stageOf(GAME).sound?.id).toBe('s9')
  })
})

describe('realtime echo', () => {
  const row = (s: Stage) => ({ id: s.id, game: s.id, data: s })

  it('does not let an older echo win while a publish is pending, and applies later ones', async () => {
    const first = deferred()
    updateImpl = (_id, body) => (body.data.sound?.id === 's1' ? first.promise : Promise.resolve({}))
    const { publishStage, receiveStage, store } = await load()
    const a = publishStage(stage('s1'))
    const b = publishStage(stage('s2'))
    receiveStage('update', row(stage('s1')))
    expect(store.stageOf(GAME).sound?.id).toBe('s2')
    first.resolve()
    await Promise.all([a, b])
    await flush()
    receiveStage('update', row(stage('s9')))
    expect(store.stageOf(GAME).sound?.id).toBe('s9')
  })

  it('applies create, update and delete, and ignores a row that fails the check', async () => {
    const { receiveStage, store } = await load()
    receiveStage('create', row(stage('s1')))
    expect(store.stageOf(GAME).sound?.id).toBe('s1')
    receiveStage('update', { id: GAME, game: GAME, data: { id: 'wrong' } })
    expect(store.stageOf(GAME).sound?.id).toBe('s1')
    receiveStage('delete', row(stage(null)))
    expect(store.stageOf(GAME).sound).toBeNull()
  })

  it('ignores events and snapshot rows for a game that is not in the store', async () => {
    const { receiveStage, applyStages, store } = await load()
    receiveStage('update', row(stage('s1', 'gone')))
    applyStages([row(stage('s1', 'gone'))])
    expect(store.byGame.gone).toBeUndefined()
  })

  it('a malformed row in a snapshot keeps the stage, an absent row removes it', async () => {
    const { applyStages, store } = await load()
    store.set(stage('s1'))
    applyStages([{ id: GAME, game: GAME, data: { id: 'wrong' } }])
    expect(store.stageOf(GAME).sound?.id).toBe('s1')
    applyStages([])
    expect(store.stageOf(GAME).sound).toBeNull()
  })

  it('a snapshot replaces the stages and drops the games without a row', async () => {
    const { applyStages, store } = await load()
    store.set(stage('s1', 'other'))
    applyStages([row(stage('s2'))])
    expect(store.stageOf(GAME).sound?.id).toBe('s2')
    expect(store.byGame.other).toBeUndefined()
  })
})
