import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { pb, type CharacterRow, type RollRow, type ChangeRow } from '@/transport/pb'
import { HISTORY_LIMIT } from './limits'
import { mode } from './mode'
import {
  BOOTSTRAP_TIMEOUT_MS,
  connection,
  isNetworkError,
  markReachable,
  onReconnect,
  reportNetworkProblem,
  stopConnectionMonitor,
  withTimeout,
} from './connection'
import { isCharacterShape, isRollRecordShape, isChangeEntryShape } from './shapes'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:pb')
const sseLog = createLogger('transport:sse')

const COLLECTIONS = ['characters', 'roll_events', 'change_events'] as const

export type BootstrapStatus = 'loading' | 'ready' | 'failed'
export const bootstrapStatus: Ref<BootstrapStatus> = ref('loading')

export const onlineDataReady: ComputedRef<boolean> = computed(
  () => mode.value === 'offline' || bootstrapStatus.value === 'ready',
)

const playedLocally = new Set<string>()

export function markRollPlayedLocally(id: string) {
  // Only realtime echoes consume the mark, and offline mode has none.
  if (mode.value === 'online') playedLocally.add(id)
}

// Bumped by every load and by stopOnline(): a load that is no longer the latest, or that finishes
// after the mode left online, must not touch the stores or the realtime connection.
let loadGen = 0

function isCurrent(gen: number): boolean {
  return gen === loadGen && mode.value === 'online'
}

// Set when the realtime connection drops, cleared on the next PB_CONNECT.
let realtimeDropped = false

// Subscriptions open before the snapshot is fetched, so nothing another player does in between is lost.
// Events that arrive while a snapshot is loading are held here and replayed on top of it; the stores
// skip duplicates (rolls, changes) and stale versions (characters, by `updated`).
let heldEvents: (() => void)[] | null = null
let holdDepth = 0

function onRealtime(apply: () => void) {
  if (heldEvents) heldEvents.push(apply)
  else apply()
}

function holdRealtime() {
  holdDepth += 1
  heldEvents ??= []
}

function releaseRealtime() {
  holdDepth = Math.max(0, holdDepth - 1)
  if (holdDepth > 0) return
  const events = heldEvents ?? []
  heldEvents = null
  for (const apply of events) apply()
}

function dropHeldRealtime() {
  holdDepth = 0
  heldEvents = null
}

// The SDK retries a dropped EventSource on its own, and unsubscribe() alone only closes a connection
// that is already established. disconnect() is private in its types but is the only way to stop those
// retries, which would otherwise keep reaching PocketBase after a switch to offline mode.
function closeRealtime() {
  dropHeldRealtime()
  pb.realtime.onDisconnect = undefined
  realtimeDropped = false
  const realtime = pb.realtime as unknown as { disconnect?: unknown }
  if (typeof realtime.disconnect === 'function') realtime.disconnect.call(pb.realtime)
  else log.warn('closeRealtime: the SDK has no disconnect(); a dropped connection may keep retrying')
  void pb.realtime.unsubscribe()
}

function fetchInitialState() {
  log.info('loadInitialState: starting')
  return Promise.all([
    pb.collection('characters').getFullList<CharacterRow>(),
    pb.collection('roll_events').getList<RollRow>(1, HISTORY_LIMIT, { sort: '-created' }),
    pb.collection('change_events').getList<ChangeRow>(1, HISTORY_LIMIT, { sort: '-created' }),
  ])
}

type InitialState = Awaited<ReturnType<typeof fetchInitialState>>

function applyInitialState([chars, rolls, changes]: InitialState) {
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  const validCharRows = chars.filter(r => isCharacterShape(r.data))
  const validRolls = rolls.items.map(r => r.data).filter(isRollRecordShape)
  const validChanges = changes.items.map(r => r.data).filter(isChangeEntryShape)

  const droppedChars = chars.length - validCharRows.length
  const droppedRolls = rolls.items.length - validRolls.length
  const droppedChanges = changes.items.length - validChanges.length
  if (droppedChars || droppedRolls || droppedChanges) {
    log.warn('loadInitialState: dropped malformed records', {
      chars: droppedChars,
      rolls: droppedRolls,
      changes: droppedChanges,
    })
  }

  characters.setAll(
    validCharRows.map(r => r.data),
    validCharRows.map(r => ({ id: r.id, updated: r.updated })),
  )
  rollHistory.setAll(validRolls)
  changeLog.setAll(validChanges)

  log.info('loadInitialState: done', {
    characters: validCharRows.length,
    rolls: validRolls.length,
    changes: validChanges.length,
  })
}

async function subscribeAll(gen: number) {
  closeRealtime()
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  await Promise.all([
    pb.collection('characters').subscribe<CharacterRow>('*', (e) => {
      sseLog.debug('characters', { action: e.action, id: e.record.id })
      if (e.action === 'create' || e.action === 'update') {
        if (!isCharacterShape(e.record.data)) {
          sseLog.warn('characters: malformed payload, ignoring', { id: e.record.id })
          return
        }
        const { data, updated } = e.record
        onRealtime(() => characters.upsertLocal(data, updated))
      } else if (e.action === 'delete') {
        const id = e.record.id
        onRealtime(() => characters.removeLocal(id))
      }
    }),

    pb.collection('roll_events').subscribe<RollRow>('*', (e) => {
      sseLog.debug('roll_events', { action: e.action, id: e.record.id })
      if (e.action === 'delete') {
        const id = e.record.id
        onRealtime(() => rollHistory.removeLocal(id))
        return
      }
      if (e.action !== 'create') return
      if (!isRollRecordShape(e.record.data)) {
        sseLog.warn('roll_events: malformed payload, ignoring', { id: e.record.id })
        return
      }
      const record = e.record.data
      onRealtime(() => {
        rollHistory.addLocal(record)
        if (playedLocally.has(record.id)) {
          playedLocally.delete(record.id)
          return
        }
        const dice = record.discardedDice ? [...record.dice, ...record.discardedDice] : record.dice
        void enqueueDice(dice, record.notation)
      })
    }),

    pb.collection('change_events').subscribe<ChangeRow>('*', (e) => {
      sseLog.debug('change_events', { action: e.action, id: e.record.id })
      if (e.action === 'delete') {
        const id = e.record.id
        onRealtime(() => changeLog.removeLocal(id))
        return
      }
      if (e.action !== 'create') return
      if (!isChangeEntryShape(e.record.data)) {
        sseLog.warn('change_events: malformed payload, ignoring', { id: e.record.id })
        return
      }
      const entry = e.record.data
      onRealtime(() => changeLog.addLocal(entry))
    }),

    // The SDK reconnects by itself after a short drop (PocketBase also closes idle connections after a
    // few minutes): that counts as recovery, and a refresh picks up events missed while disconnected.
    // Once down, the reconnect loop owns recovery and reloads everything itself.
    pb.realtime.subscribe('PB_CONNECT', () => {
      if (!realtimeDropped) return
      realtimeDropped = false
      if (connection.value === 'down') return
      markReachable()
      void refreshOnline()
    }),
  ])

  if (!isCurrent(gen)) return
  pb.realtime.onDisconnect = () => {
    if (mode.value !== 'online') return
    realtimeDropped = true
    reportNetworkProblem()
  }
  log.info('SSE subscriptions registered', { collections: COLLECTIONS })
}

function remaining(deadline: number): number {
  return Math.max(0, deadline - Date.now())
}

// Applies a fresh snapshot, then the realtime events that arrived while it was loading. The fetch has
// its own timeout, so a hanging request cannot keep the events held.
async function fetchAndApply(gen: number, deadline: number) {
  holdRealtime()
  try {
    const state = await withTimeout(fetchInitialState(), remaining(deadline))
    if (!isCurrent(gen)) return
    applyInitialState(state)
  } finally {
    // Otherwise closeRealtime() has already dropped them for the newer load or the mode switch.
    if (isCurrent(gen)) releaseRealtime()
  }
}

// Subscribe first, then fetch, under one deadline: a hanging realtime connection must not double the wait.
async function loadAndSubscribe(gen: number) {
  const deadline = Date.now() + BOOTSTRAP_TIMEOUT_MS
  await withTimeout(subscribeAll(gen), BOOTSTRAP_TIMEOUT_MS)
  if (!isCurrent(gen)) return
  await fetchAndApply(gen, deadline)
}

// Data only: the SDK has already restored the subscriptions on reconnect.
async function refreshOnline() {
  const gen = loadGen
  try {
    await fetchAndApply(gen, Date.now() + BOOTSTRAP_TIMEOUT_MS)
  } catch (err) {
    log.warn('refresh after realtime reconnect failed', { err })
    if (isCurrent(gen) && isNetworkError(err)) reportNetworkProblem()
  }
}

async function reloadOnline() {
  const gen = ++loadGen
  if (!isCurrent(gen)) return
  closeRealtime()
  await loadAndSubscribe(gen)
  if (!isCurrent(gen)) return
  bootstrapStatus.value = 'ready'
}

export async function bootstrap() {
  if (mode.value !== 'online') return
  const gen = ++loadGen
  onReconnect(reloadOnline)
  bootstrapStatus.value = 'loading'
  try {
    await loadAndSubscribe(gen)
    if (!isCurrent(gen)) return
    bootstrapStatus.value = 'ready'
    markReachable()
  } catch (err) {
    if (!isCurrent(gen)) return
    log.error('bootstrap failed — waiting for the server', { err })
    bootstrapStatus.value = 'failed'
    // The timeout already gave the server its chance, so no grace period on top.
    reportNetworkProblem({ immediate: true })
  }
}

export function stopOnline(): void {
  loadGen += 1
  closeRealtime()
  stopConnectionMonitor()
  playedLocally.clear()
  bootstrapStatus.value = 'loading'
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.info('HMR dispose: closing realtime')
    closeRealtime()
  })
}
