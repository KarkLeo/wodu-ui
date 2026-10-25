import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { pb, type CharacterRow, type RollRow, type ChangeRow } from '@/transport/pb'
import { HISTORY_LIMIT } from './limits'
import { mode } from './mode'
import {
  BOOTSTRAP_TIMEOUT_MS,
  connection,
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

// The SDK retries a dropped EventSource on its own, and unsubscribe() alone only closes a connection
// that is already established. disconnect() is private in its types but is the only way to stop those
// retries, which would otherwise keep reaching PocketBase after a switch to offline mode.
function closeRealtime() {
  pb.realtime.onDisconnect = undefined
  ;(pb.realtime as unknown as { disconnect(): void }).disconnect()
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
        characters.upsertLocal(e.record.data, e.record.updated)
      } else if (e.action === 'delete') {
        characters.removeLocal(e.record.id)
      }
    }),

    pb.collection('roll_events').subscribe<RollRow>('*', (e) => {
      sseLog.debug('roll_events', { action: e.action, id: e.record.id })
      if (e.action === 'delete') {
        rollHistory.removeLocal(e.record.id)
        return
      }
      if (e.action !== 'create') return
      if (!isRollRecordShape(e.record.data)) {
        sseLog.warn('roll_events: malformed payload, ignoring', { id: e.record.id })
        return
      }
      const record = e.record.data
      rollHistory.addLocal(record)
      if (playedLocally.has(record.id)) {
        playedLocally.delete(record.id)
        return
      }
      const dice = record.discardedDice ? [...record.dice, ...record.discardedDice] : record.dice
      void enqueueDice(dice, record.notation)
    }),

    pb.collection('change_events').subscribe<ChangeRow>('*', (e) => {
      sseLog.debug('change_events', { action: e.action, id: e.record.id })
      if (e.action === 'delete') {
        changeLog.removeLocal(e.record.id)
        return
      }
      if (e.action !== 'create') return
      if (!isChangeEntryShape(e.record.data)) {
        sseLog.warn('change_events: malformed payload, ignoring', { id: e.record.id })
        return
      }
      changeLog.addLocal(e.record.data)
    }),

    // The SDK reconnects by itself after a short drop (PocketBase also closes idle connections after a
    // few minutes); within the grace period that counts as recovery. Once down, the reconnect loop owns
    // recovery because it reloads what was missed.
    pb.realtime.subscribe('PB_CONNECT', () => {
      if (connection.value === 'checking') markReachable()
    }),
  ])

  if (!isCurrent(gen)) return
  pb.realtime.onDisconnect = () => {
    if (mode.value === 'online') reportNetworkProblem()
  }
  log.info('SSE subscriptions registered', { collections: COLLECTIONS })
}

async function loadAndSubscribe(gen: number) {
  const state = await withTimeout(fetchInitialState(), BOOTSTRAP_TIMEOUT_MS)
  if (!isCurrent(gen)) return
  applyInitialState(state)
  await withTimeout(subscribeAll(gen), BOOTSTRAP_TIMEOUT_MS)
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
