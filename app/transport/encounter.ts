import { pb, type EncounterHitRow, type EncounterMonsterRow, type EncounterRow } from '@/transport/pb'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { modeSession } from './mode'
import { reportWriteFailure } from './writeFailure'
import {
  addInstance,
  checkEncounterHit,
  checkEncounterMonster,
  checkEncounterState,
  emptyEncounter,
} from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import type { LibraryMonster } from '@/types/library'
import type { EncounterHit, EncounterMonster, EncounterState } from '@/types/encounter'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('transport:encounter')

const COLLECTIONS = ['encounters', 'encounter_monsters', 'encounter_hits'] as const

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : undefined
}

interface Writer<T> {
  /** Shows `next` at once and sends it; `prior` is what the screen held, the rollback target if nothing is confirmed yet. */
  submit(key: string, prior: T | undefined, next: T): void
  /** Drops what has not been sent yet for `key`. */
  forget(key: string): void
  /** True while a write for `key` is in flight or waiting. */
  busy(key: string): boolean
}

interface Chain<T> {
  confirmed: T | undefined
  pending: T | undefined
  hasPending: boolean
}

/**
 * One request in flight per key; the newest value waiting replaces any older one, so three fast clicks
 * make at most two writes and the last value always lands. A failure restores the last confirmed value
 * unless a newer change is waiting, which is about to overwrite it anyway.
 */
function serialWriter<T>(opts: {
  show: (value: T) => void
  restore: (key: string, value: T) => void
  send: (key: string, value: T) => Promise<unknown>
  message: () => string
}): Writer<T> {
  const chains = new Map<string, Chain<T>>()

  async function pump(key: string, chain: Chain<T>) {
    const current = staysCurrent()
    const session = modeSession()
    while (chain.hasPending) {
      const value = chain.pending as T
      chain.pending = undefined
      chain.hasPending = false
      try {
        await call(() => opts.send(key, value))
        chain.confirmed = value
      } catch (err) {
        log.error('write failed', { key, err })
        if (!current()) break
        if (chain.hasPending) continue
        if (chain.confirmed !== undefined) opts.restore(key, chain.confirmed)
        reportWriteFailure(err, opts.message(), session)
      }
    }
    chain.hasPending = false
    chain.pending = undefined
    if (chains.get(key) === chain) chains.delete(key)
  }

  return {
    submit(key, prior, next) {
      opts.show(next)
      const existing = chains.get(key)
      if (existing) {
        existing.pending = next
        existing.hasPending = true
        return
      }
      const chain: Chain<T> = { confirmed: prior, pending: next, hasPending: true }
      chains.set(key, chain)
      void pump(key, chain)
    },
    forget(key) {
      const chain = chains.get(key)
      if (!chain) return
      chain.pending = undefined
      chain.hasPending = false
    },
    busy: key => chains.has(key),
  }
}

const monsterWriter = serialWriter<EncounterMonster>({
  show: m => useEncounterStore().putMonster(m),
  // A monster removed meanwhile must not come back.
  restore: (_key, m) => {
    const store = useEncounterStore()
    if (store.monsterById(m.id)) store.putMonster(m)
  },
  send: (key, m) => pb.collection('encounter_monsters').update(key, { data: m }),
  message: () => t('errors.encounterSaveFailed'),
})

// Keyed by the state's own id (= game id): a write that outlives a table switch must not touch the next game's state.
const stateWriter = serialWriter<EncounterState>({
  show: (s) => {
    const store = useEncounterStore()
    if (store.gameId === s.id) store.setState(s)
  },
  restore: (_key, s) => {
    const store = useEncounterStore()
    if (store.gameId === s.id) store.setState(s)
  },
  send: (_key, s) => pb.collection('encounters').update(s.id, { data: s }),
  message: () => t('errors.encounterSaveFailed'),
})

let openGen = 0
let held: (() => void)[] | null = null

// Events that arrive while the snapshot loads are replayed on top of it.
function onEvent(gen: number, apply: () => void) {
  if (gen !== openGen) return
  if (held) held.push(apply)
  else apply()
}

function subscribeAll(gen: number, gameId: string) {
  const store = useEncounterStore()
  const mine = (row: { game: string }) => row.game === gameId && store.gameId === gameId

  return Promise.all([
    pb.collection('encounters').subscribe<EncounterRow>('*', (e) => {
      if (e.action === 'delete') return
      const row = e.record
      const state = checkEncounterState(row.data)
      if (!state || state.id !== row.id || row.id !== gameId || !mine(row)) return
      // Our own write is about to land last; its older echo must not undo it.
      onEvent(gen, () => { if (!stateWriter.busy(gameId)) store.setState(state) })
    }),
    pb.collection('encounter_monsters').subscribe<EncounterMonsterRow>('*', (e) => {
      const row = e.record
      if (!mine(row)) return
      if (e.action === 'delete') {
        onEvent(gen, () => store.removeMonster(row.id))
        return
      }
      const monster = checkEncounterMonster(row.data)
      if (!monster || monster.id !== row.id) {
        log.warn('dropping a malformed monster event', { id: row.id })
        return
      }
      onEvent(gen, () => store.upsertMonster(monster))
    }),
    pb.collection('encounter_hits').subscribe<EncounterHitRow>('*', (e) => {
      if (e.action !== 'create' || !mine(e.record)) return
      const hit = checkEncounterHit(e.record.data)
      if (!hit || hit.id !== e.record.id) return
      onEvent(gen, () => store.upsertHit(hit))
    }),
  ])
}

async function loadState(gameId: string): Promise<EncounterState> {
  const read = async () => {
    const row = await pb.collection('encounters').getOne<EncounterRow>(gameId)
    const state = checkEncounterState(row.data)
    if (!state || state.id !== row.id) throw new Error('the encounter state fails the shape check')
    return state
  }
  try {
    return await read()
  } catch (err) {
    if (statusOf(err) !== 404) throw err
  }
  const fresh = emptyEncounter(gameId)
  try {
    await pb.collection('encounters').create({ id: gameId, game: gameId, data: fresh })
    return fresh
  } catch (err) {
    // The master's other device created it first.
    if (statusOf(err) !== 400) throw err
    return read()
  }
}

async function loadAll(gameId: string) {
  const filter = pb.filter('game = {:g}', { g: gameId })
  const [state, monsterRows, hitRows] = await Promise.all([
    loadState(gameId),
    pb.collection('encounter_monsters').getFullList<EncounterMonsterRow>({ filter }),
    pb.collection('encounter_hits').getFullList<EncounterHitRow>({ filter }),
  ])
  const monsters: EncounterMonster[] = []
  for (const r of monsterRows) {
    const m = checkEncounterMonster(r.data)
    if (m && m.id === r.id) monsters.push(m)
    else log.warn('dropping a monster that fails the shape check', { id: r.id })
  }
  const hits: EncounterHit[] = []
  for (const r of hitRows) {
    const h = checkEncounterHit(r.data)
    if (h && h.id === r.id) hits.push(h)
    else log.warn('dropping a hit that fails the shape check', { id: r.id })
  }
  return { state, monsters, hits }
}

function unsubscribeOwn() {
  for (const name of COLLECTIONS) void pb.collection(name).unsubscribe('*')
}

/**
 * Master: subscribes to the game's encounter collections, then loads them. Events that arrive during the
 * load are held and replayed on top of it. A failure leaves the store `failed` and is not rethrown.
 */
export async function openEncounter(gameId: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const gen = ++openGen
  const store = useEncounterStore()
  const open = () => gen === openGen && current() && store.gameId === gameId
  unsubscribeOwn()
  store.startLoading(gameId)
  held = []
  try {
    await call(() => subscribeAll(gen, gameId))
    if (!open()) return
    const { state, monsters, hits } = await call(() => loadAll(gameId))
    if (!open()) return
    store.setAll(gameId, state, monsters, hits)
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
export function closeEncounter(): void {
  openGen += 1
  held = null
  unsubscribeOwn()
}

function mayWrite(gameId: string): EncounterState {
  requireOnlineUser()
  const store = useEncounterStore()
  if (store.gameId !== gameId || !store.state) throw new Error('the encounter is not loaded')
  return store.state
}

// Adds run one after another, so each takes its number from the counters the previous one left.
let addQueue: Promise<unknown> = Promise.resolve()

/** Master: adds an instance of a library monster. The monster is written first, then the counter. */
export function addMonster(gameId: string, entry: LibraryMonster): Promise<void> {
  const run = addQueue.catch(() => undefined).then(() => addOne(gameId, entry))
  addQueue = run
  return run
}

async function addOne(gameId: string, entry: LibraryMonster): Promise<void> {
  const state = mayWrite(gameId)
  const current = staysCurrent()
  const { monster } = addInstance(state, entry, crypto.randomUUID(), Date.now())
  await call(() => pb.collection('encounter_monsters').create({ id: monster.id, game: gameId, data: monster }))
  if (!current()) return
  const store = useEncounterStore()
  const here = store.gameId === gameId
  if (here) store.putMonster(monster)
  // Recorded even if the table has moved on, or the number could be handed out again. The state may have
  // changed while the monster was being written (a sort switch), so merge into the latest.
  const latest = here && store.state ? store.state : state
  stateWriter.submit(gameId, latest, {
    ...latest,
    manualOrder: [monster.id, ...latest.manualOrder],
    counters: { ...latest.counters, [entry.id]: Math.max(latest.counters[entry.id] ?? 0, monster.n) },
  })
}

/** Master: the one write path for HP, conditions and edits; see `serialWriter`. */
export function saveMonster(next: EncounterMonster): void {
  requireOnlineUser()
  const store = useEncounterStore()
  monsterWriter.submit(next.id, store.monsterById(next.id), next)
}

/** Master: deletes an instance; its number stays taken in the counters. */
export async function removeMonsterInstance(id: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  monsterWriter.forget(id)
  try {
    await call(() => pb.collection('encounter_monsters').delete(id))
  } catch (err) {
    if (statusOf(err) !== 404) throw err
  }
  if (current()) useEncounterStore().removeMonster(id)
}

/** Master: sort mode and manual order, written like a monster edit. */
export function saveEncounterState(next: EncounterState): void {
  requireOnlineUser()
  const store = useEncounterStore()
  stateWriter.submit(next.id, store.state?.id === next.id ? store.state : undefined, next)
}

/**
 * Master: records an applied roll. The mark is kept locally first, so a failed write still blocks a second
 * application; the error is rethrown for the caller to retry and report.
 */
export async function recordHit(gameId: string, hit: EncounterHit): Promise<void> {
  requireOnlineUser()
  const data = checkEncounterHit(hit)
  if (!data) throw new Error('invalid hit')
  const current = staysCurrent()
  const store = useEncounterStore()
  if (store.gameId === gameId) store.upsertHit(data)
  try {
    await call(() => pb.collection('encounter_hits').create({ id: data.id, game: gameId, data }))
  } catch (err) {
    if (current()) log.error('recordHit failed', { id: data.id, err })
    throw err
  }
}
