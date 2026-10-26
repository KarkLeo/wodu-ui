import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { pb, type CharacterRow, type RollRow, type ChangeRow, type GameRow, type GameMemberRow } from '@/transport/pb'
import { HISTORY_LIMIT } from './limits'
import { mode } from './mode'
import { currentUser, restoreSession, signedIn } from './auth'
import { canLoadOnline } from './authHelpers'
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
import { scope } from './scope'
import { forgetGame, loadGame, toGame, toMember } from './games'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { eventFilter, eventInScope } from '@/utils/scope'
import type { Scope } from '@/types/game'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:pb')
const sseLog = createLogger('transport:sse')

const COLLECTIONS = ['games', 'game_members', 'characters', 'roll_events', 'change_events'] as const

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

// Signed out counts as stale too, so a reconnect after sign-out cannot reload or resubscribe anonymously.
function isCurrent(gen: number): boolean {
  return gen === loadGen && canLoadOnline(mode.value, signedIn.value)
}

// True from bootstrap() until stopOnline(): only then does a scope change reload the events.
let started = false

// Bumped by every scope change: an event load for a scope the player has already left must not land.
let eventsGen = 0

function me(): string | null {
  return currentUser.value?.id ?? null
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

// The home screen shows no log, so it loads no events.
async function fetchEvents(target: Scope) {
  const filter = eventFilter(target)
  if (filter === null) return { rolls: [] as RollRow[], changes: [] as ChangeRow[] }
  const [rolls, changes] = await Promise.all([
    pb.collection('roll_events').getList<RollRow>(1, HISTORY_LIMIT, { sort: '-created', filter }),
    pb.collection('change_events').getList<ChangeRow>(1, HISTORY_LIMIT, { sort: '-created', filter }),
  ])
  return { rolls: rolls.items, changes: changes.items }
}

type EventRows = Awaited<ReturnType<typeof fetchEvents>>

async function fetchInitialState() {
  log.info('loadInitialState: starting')
  const events = eventsGen
  const [games, members, chars, { rolls, changes }] = await Promise.all([
    pb.collection('games').getFullList<GameRow>(),
    pb.collection('game_members').getFullList<GameMemberRow>({ expand: 'user' }),
    pb.collection('characters').getFullList<CharacterRow>(),
    fetchEvents(scope.value),
  ])
  return { games, members, chars, rolls, changes, events }
}

type InitialState = Awaited<ReturnType<typeof fetchInitialState>>

function applyEvents({ rolls, changes }: EventRows) {
  const validRolls = rolls.map(r => r.data).filter(isRollRecordShape)
  const validChanges = changes.map(r => r.data).filter(isChangeEntryShape)
  const droppedRolls = rolls.length - validRolls.length
  const droppedChanges = changes.length - validChanges.length
  if (droppedRolls || droppedChanges) {
    log.warn('events: dropped malformed records', { rolls: droppedRolls, changes: droppedChanges })
  }
  useRollHistoryStore().setAll(validRolls)
  useChangeLogStore().setAll(validChanges)
  return { rolls: validRolls.length, changes: validChanges.length }
}

function applyInitialState(state: InitialState) {
  const validCharRows = state.chars.filter(r => isCharacterShape(r.data))
  const droppedChars = state.chars.length - validCharRows.length
  if (droppedChars) log.warn('loadInitialState: dropped malformed characters', { chars: droppedChars })

  useGamesStore().setAll(state.games.map(toGame), state.members.map(toMember))
  useCharactersStore().setAll(
    validCharRows.map(r => r.data),
    validCharRows.map(r => ({ id: r.id, updated: r.updated, owner: r.owner, game: r.game })),
  )
  // The player switched tables while this was loading; that switch loads its own events.
  const events = state.events === eventsGen ? applyEvents(state) : 'skipped'

  log.info('loadInitialState: done', {
    games: state.games.length,
    characters: validCharRows.length,
    events,
  })
}

async function subscribeAll(gen: number) {
  closeRealtime()
  const games = useGamesStore()
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  await Promise.all([
    pb.collection('games').subscribe<GameRow>('*', (e) => {
      sseLog.debug('games', { action: e.action, id: e.record.id })
      const row = e.record
      if (e.action === 'create' || e.action === 'update') onRealtime(() => games.upsertGame(toGame(row)))
      else if (e.action === 'delete') onRealtime(() => forgetGame(row.id))
    }),

    // Losing a membership sends only the membership's own delete: the rest of the game is dropped here.
    pb.collection('game_members').subscribe<GameMemberRow>('*', (e) => {
      sseLog.debug('game_members', { action: e.action, id: e.record.id })
      const row = e.record
      if (e.action === 'create') {
        onRealtime(() => {
          const known = !!games.byId(row.game)
          games.upsertMember(toMember(row))
          // Joined from another session or device: nothing else about the game arrives on its own.
          if (row.user === me() && !known) {
            void loadGame(row.game).catch((err: unknown) => {
              log.warn('loading a joined game failed', { game: row.game, err })
              if (isNetworkError(err)) reportNetworkProblem()
            })
          }
        })
      } else if (e.action === 'delete') {
        onRealtime(() => {
          games.removeMember(row.id)
          if (row.user === me()) forgetGame(row.game)
          // A member who left or was removed took their characters along, and those are unreadable now.
          else characters.removeGameOthers(row.game, me(), row.user)
        })
      }
    }, { expand: 'user' }),

    pb.collection('characters').subscribe<CharacterRow>('*', (e) => {
      sseLog.debug('characters', { action: e.action, id: e.record.id })
      if (e.action === 'create' || e.action === 'update') {
        if (!isCharacterShape(e.record.data)) {
          sseLog.warn('characters: malformed payload, ignoring', { id: e.record.id })
          return
        }
        const { data, updated, owner, game } = e.record
        onRealtime(() => characters.upsertLocal(data, updated, { owner, game }))
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
      const row = { character: e.record.character, game: e.record.game }
      onRealtime(() => {
        if (!eventInScope(row, scope.value)) {
          playedLocally.delete(record.id)
          return
        }
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
      const row = { character: e.record.character, game: e.record.game }
      onRealtime(() => {
        if (eventInScope(row, scope.value)) changeLog.addLocal(entry)
      })
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

// Another table is open: its log replaces the old one. Realtime events held meanwhile are replayed on top.
async function reloadEvents() {
  const gen = loadGen
  const events = ++eventsGen
  const target = scope.value
  useRollHistoryStore().clearAll()
  useChangeLogStore().clearAll()
  if (eventFilter(target) === null) return
  holdRealtime()
  try {
    const rows = await withTimeout(fetchEvents(target), BOOTSTRAP_TIMEOUT_MS)
    if (!isCurrent(gen) || events !== eventsGen) return
    log.info('events reloaded for the open table', { scope: target.kind, ...applyEvents(rows) })
  } catch (err) {
    if (!isCurrent(gen) || events !== eventsGen) return
    log.warn('loading the events of the open table failed', { err })
    if (isNetworkError(err)) reportNetworkProblem()
  } finally {
    if (isCurrent(gen)) releaseRealtime()
  }
}

const stopScopeWatch = watch(scope, () => {
  if (started && isCurrent(loadGen)) void reloadEvents()
})

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
  // The account may have been deleted or signed out elsewhere while the server was away.
  await restoreSession()
  const gen = ++loadGen
  if (!isCurrent(gen)) return
  closeRealtime()
  await loadAndSubscribe(gen)
  if (!isCurrent(gen)) return
  bootstrapStatus.value = 'ready'
}

export async function bootstrap() {
  // Signed out, the server answers with empty lists, which would look like an empty table.
  if (!canLoadOnline(mode.value, signedIn.value)) return
  const gen = ++loadGen
  started = true
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
  eventsGen += 1
  started = false
  closeRealtime()
  useGamesStore().clearAll()
  stopConnectionMonitor()
  playedLocally.clear()
  bootstrapStatus.value = 'loading'
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.info('HMR dispose: closing realtime')
    stopScopeWatch()
    closeRealtime()
  })
}
