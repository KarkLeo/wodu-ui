import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every side effect of a switch lands in one list, so the tests can check what ran and in which order.
const calls: string[] = []
let restoreGate: Array<() => void> = []

vi.mock('./bootstrap', () => ({
  stopOnline: () => calls.push('stopOnline'),
  bootstrap: async () => { calls.push('bootstrap') },
}))
vi.mock('./auth', () => ({
  // Resolves only when the test says so, to hold an online start mid-way.
  restoreSession: () => {
    calls.push('restoreSession')
    return new Promise<void>(resolve => restoreGate.push(resolve))
  },
}))
vi.mock('./offlineStorage', () => ({
  loadOffline: () => calls.push('loadOffline'),
  startOfflinePersistence: () => {
    calls.push('startPersistence')
    return () => calls.push('stopPersistence')
  },
}))
vi.mock('@/stores/characters', () => ({ useCharactersStore: () => ({ clearAll: () => calls.push('clear characters') }) }))
vi.mock('@/stores/rollHistory', () => ({ useRollHistoryStore: () => ({ clearAll: () => calls.push('clear rolls') }) }))
vi.mock('@/stores/changeLog', () => ({ useChangeLogStore: () => ({ clearAll: () => calls.push('clear changes') }) }))

const CLEAR = ['clear characters', 'clear rolls', 'clear changes']

// Fresh module state (the mode, its session counter, the offline watcher) for every test.
async function load() {
  vi.resetModules()
  const modeModule = await import('./mode')
  const switcher = await import('./modeSwitch')
  return { ...modeModule, ...switcher }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  calls.length = 0
  restoreGate = []
})

describe('enterMode', () => {
  it('does nothing when the mode already matches', async () => {
    const { enterMode, mode, modeSession } = await load()
    const session = modeSession()
    enterMode(mode.value)
    expect(calls).toEqual([])
    expect(modeSession()).toBe(session)
  })

  it('online → offline: stops the online session before clearing, then loads the device data', async () => {
    const { enterMode, mode, modeSession } = await load()
    const session = modeSession()
    enterMode('offline')
    expect(mode.value).toBe('offline')
    expect(modeSession()).toBe(session + 1)
    expect(calls).toEqual(['stopOnline', ...CLEAR, 'loadOffline', 'startPersistence'])
  })

  it('offline → online: stops the offline watcher before clearing, so the cleared lists are not saved', async () => {
    const { enterMode, setMode, startOfflineSession, mode } = await load()
    setMode('offline')
    startOfflineSession()
    calls.length = 0
    enterMode('online')
    expect(mode.value).toBe('online')
    expect(calls).toEqual(['stopPersistence', ...CLEAR, 'restoreSession'])
    restoreGate[0]!()
    await flush()
    expect(calls.at(-1)).toBe('bootstrap')
  })

  it('a stale online start is dropped after a fast online → offline → online', async () => {
    const { enterMode, setMode, startOfflineSession } = await load()
    setMode('offline')
    startOfflineSession()
    enterMode('online')
    enterMode('offline')
    enterMode('online')
    expect(restoreGate).toHaveLength(2)
    calls.length = 0

    restoreGate[0]!()
    await flush()
    expect(calls).toEqual([])

    restoreGate[1]!()
    await flush()
    expect(calls).toEqual(['bootstrap'])
  })

  it('an online start interrupted by offline never loads online data', async () => {
    const { enterMode, setMode, mode } = await load()
    setMode('offline')
    enterMode('online')
    enterMode('offline')
    calls.length = 0
    restoreGate[0]!()
    await flush()
    expect(calls).toEqual([])
    expect(mode.value).toBe('offline')
  })
})
