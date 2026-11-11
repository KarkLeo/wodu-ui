import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

let stagesList: () => Promise<unknown[]>
let stagesSubscribe: () => Promise<unknown>
const reported: unknown[] = []

vi.mock('@/transport/pb', () => ({
  pb: {
    filter: (raw: string) => raw,
    realtime: { onDisconnect: undefined, subscribe: async () => async () => {}, unsubscribe: async () => {}, disconnect() {} },
    collection: (name: string) => ({
      getFullList: async () => {
        if (name === 'stages') return stagesList()
        if (name === 'games') return [{ id: 'g1', name: 'G', master: 'u1', invite_code: 'ABCD2345', created: '' }]
        return []
      },
      getList: async () => ({ items: [] }),
      subscribe: async () => (name === 'stages' ? stagesSubscribe() : async () => {}),
      unsubscribe: async () => {},
    }),
  },
}))
vi.mock('./auth', () => ({
  currentUser: ref({ id: 'u1' }),
  signedIn: ref(true),
  restoreSession: async () => 'signed-in',
}))
vi.mock('@/services/DiceAnimationQueue', () => ({ enqueueCoalesced: async () => {} }))
vi.mock('./connection', async (orig) => ({
  ...(await orig<typeof import('./connection')>()),
  reportNetworkProblem: (o: unknown) => reported.push(o),
  markReachable: () => {},
  onReconnect: () => {},
  stopConnectionMonitor: () => {},
}))

const row = (soundId: string) => ({
  id: 'g1',
  game: 'g1',
  data: {
    id: 'g1', scene: null, image: null,
    sound: { id: soundId, file: { collection: 'sounds', record: soundId, name: 'a.mp3' }, loop: false, startedAt: 'x' },
  },
})

async function load() {
  vi.resetModules()
  setActivePinia(createPinia())
  const boot = await import('./bootstrap')
  const { useStageStore } = await import('@/stores/stage')
  const { useGamesStore } = await import('@/stores/games')
  return { ...boot, stages: useStageStore(), games: useGamesStore() }
}

beforeEach(() => {
  reported.length = 0
  stagesList = async () => []
  stagesSubscribe = async () => async () => {}
})

describe('bootstrap and the stages', () => {
  it('loads the stage of a game next to the games', async () => {
    stagesList = async () => [row('s1')]
    const { bootstrap, bootstrapStatus, stages } = await load()
    await bootstrap()
    expect(bootstrapStatus.value).toBe('ready')
    expect(stages.stageOf('g1').sound?.id).toBe('s1')
  })

  it('a refused or missing stages list does not fail the start', async () => {
    stagesList = async () => { throw Object.assign(new Error('not found'), { status: 404 }) }
    const { bootstrap, bootstrapStatus, games, stages } = await load()
    await bootstrap()
    expect(bootstrapStatus.value).toBe('ready')
    expect(games.games).toHaveLength(1)
    expect(stages.stageOf('g1').sound).toBeNull()
    expect(reported).toHaveLength(0)
  })

  it('a failed stages subscription does not fail the start', async () => {
    stagesSubscribe = async () => { throw Object.assign(new Error('not found'), { status: 404 }) }
    const { bootstrap, bootstrapStatus } = await load()
    await bootstrap()
    expect(bootstrapStatus.value).toBe('ready')
  })

  it('ignores the row of a game that is not in the store', async () => {
    stagesList = async () => [{ ...row('s1'), id: 'other', game: 'other', data: { ...row('s1').data, id: 'other' } }]
    const { bootstrap, stages } = await load()
    await bootstrap()
    expect(stages.byGame.other).toBeUndefined()
  })
})
