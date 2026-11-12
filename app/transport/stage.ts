import { pb, type StageRow } from '@/transport/pb'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { serialWriter, WriteDropped } from './serialWriter'
export { WriteDropped }
import { checkStage } from '@/domain/stage'
import { useStageStore, type StageSource } from '@/stores/stage'
import { useGamesStore } from '@/stores/games'
import type { Stage } from '@/types/stage'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('transport:stage')

function statusOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: unknown }).status) : undefined
}

export function stageFromRow(row: StageRow): Stage | null {
  const stage = checkStage(row.data, row.id)
  if (!stage || row.game !== row.id) {
    log.warn('ignoring a malformed stage row', { id: row.id })
    return null
  }
  return stage
}

// Games whose row the server has shown (snapshot, realtime) or accepted. The row exists only once the master
// has published, and the browser logs every 404 as a console error, so a game's first publish creates instead
// of probing with an update. Either guess falls back: a refused create means the row appeared meanwhile.
const rowSeen = new Set<string>()

/** Forgets which rows exist; called wherever the stage store is cleared. */
export function forgetStageRows(): void {
  rowSeen.clear()
  skipped.clear()
}

// Games whose row came in (realtime or a snapshot) while this device's own write for them was in flight, and was set
// aside so it could not undo the newer optimistic value. Once the writer settles, that game's row is read once.
const skipped = new Set<string>()

// How many stage values were applied per game (a publish, a rollback, a realtime row, a snapshot). A re-read whose answer
// comes back after another value was applied is older than what is shown, and is dropped.
const applied = new Map<string, number>()
function noteApplied(gameId: string): void {
  applied.set(gameId, (applied.get(gameId) ?? 0) + 1)
}

// The same stage, whatever order its keys were built in.
function sameStage(a: Stage, b: Stage): boolean {
  return JSON.stringify(checkStage(a, a.id)) === JSON.stringify(checkStage(b, b.id))
}

// A row that arrives during a write is set aside, unless it is what this device is showing (the echo of its own newest write).
function setAside(row: StageRow): void {
  const stage = stageFromRow(row)
  if (stage && sameStage(stage, useStageStore().stageOf(row.id))) return
  skipped.add(row.id)
}

/** Reads the game's row once and applies it, as a load, when it differs from what is shown; never loops, never toasts. */
async function reread(gameId: string): Promise<void> {
  const current = staysCurrent()
  const before = applied.get(gameId) ?? 0
  try {
    // Online and signed in, or nothing is sent.
    requireOnlineUser()
    const rows = await call(() => pb.collection('stages').getFullList<StageRow>({ filter: pb.filter('id = {:id}', { id: gameId }) }))
    if (!current() || !useGamesStore().byId(gameId)) return
    // Something newer was applied while the read was on its way: it wins.
    if ((applied.get(gameId) ?? 0) !== before) return
    // Another write began meanwhile: the read waits for it in turn.
    if (writer.busy(gameId)) {
      skipped.add(gameId)
      return
    }
    const row = rows.find(r => r.id === gameId)
    const store = useStageStore()
    if (!row) {
      rowSeen.delete(gameId)
      noteApplied(gameId)
      store.remove(gameId)
      return
    }
    rowSeen.add(gameId)
    const stage = stageFromRow(row)
    if (stage && !sameStage(stage, store.stageOf(gameId))) {
      noteApplied(gameId)
      store.set(stage, 'load')
    }
  } catch (err) {
    log.debug('re-reading the stage after a write failed', { gameId, err })
  }
}

async function send(gameId: string, stage: Stage): Promise<void> {
  const rows = pb.collection('stages')
  const update = () => rows.update(gameId, { data: stage })
  const create = () => rows.create({ id: gameId, game: gameId, data: stage })
  if (rowSeen.has(gameId)) {
    try {
      await update()
    } catch (err) {
      if (statusOf(err) !== 404) throw err
      try {
        await create()
      } catch (createErr) {
        if (statusOf(createErr) !== 400) throw createErr
        await update()
      }
    }
  } else {
    try {
      await create()
    } catch (err) {
      if (statusOf(err) !== 400) throw err
      await update()
    }
  }
  rowSeen.add(gameId)
}

interface Waiter { resolve: () => void; reject: (err: unknown) => void }
const waiters = new Map<string, Waiter[]>()

// Games whose newest publish asked not to be reported when it fails.
const quiet = new Map<string, boolean>()

// Every caller of a coalesced chain is told the chain's final outcome, not its own: a caller whose value was confirmed is
// told "failed" when a later value folded into the same chain fails (and the stage then shows the last confirmed value).
// Accepted: the panels follow the stage store, not this promise, and the stage writer's one toast says what happened.
const writer = serialWriter<Stage>({
  show: (stage) => {
    noteApplied(stage.id)
    useStageStore().set(stage)
  },
  // A game forgotten meanwhile must not get its stage back.
  restore: (_key, stage) => {
    if (!useGamesStore().byId(stage.id)) return
    noteApplied(stage.id)
    useStageStore().set(stage)
  },
  send,
  message: key => (quiet.get(key) ? null : t('errors.stageFailed')),
  settled: (key, error) => {
    const list = waiters.get(key) ?? []
    waiters.delete(key)
    quiet.delete(key)
    for (const w of list) {
      if (error === null) w.resolve()
      else w.reject(error)
    }
    if (skipped.delete(key)) void reread(key)
  },
})

/**
 * Master: makes `next` live. Optimistic; writes run one after another per game and only the newest waits; a
 * failure restores the last confirmed stage and rethrows. Rejects with `WriteDropped` (not a failure: the
 * server may have accepted it) when the mode or the user changed before the write finished. Swallows nothing.
 */
export async function publishStage(next: Stage, options: { quiet?: boolean } = {}): Promise<void> {
  requireOnlineUser()
  // Quiet only while every publish folded into the write is: a user's failure must not go unreported.
  quiet.set(next.id, options.quiet === true && (!writer.busy(next.id) || quiet.get(next.id) === true))
  const prior = useStageStore().stageOf(next.id)
  await new Promise<void>((resolve, reject) => {
    const list = waiters.get(next.id) ?? []
    list.push({ resolve, reject })
    waiters.set(next.id, list)
    writer.submit(next.id, prior, next)
  })
}

// While my own publish for a game is pending, an older echo of it must not undo the newer optimistic value; a row that
// differs from what is shown is set aside and the game's row is read again once the publish has settled.
export function receiveStage(action: string, row: StageRow, source: StageSource = 'live'): void {
  if (action === 'delete') rowSeen.delete(row.id)
  else rowSeen.add(row.id)
  const store = useStageStore()
  if (!useGamesStore().byId(row.id)) return
  if (writer.busy(row.id)) {
    // A delete is not an echo of anything this device writes.
    if (action === 'delete') skipped.add(row.id)
    else setAside(row)
    return
  }
  if (action === 'delete') {
    noteApplied(row.id)
    store.remove(row.id)
    return
  }
  const stage = stageFromRow(row)
  if (!stage) return
  noteApplied(row.id)
  store.set(stage, source)
}

/**
 * A fresh snapshot of every readable row, applied after the games are in the store: games with no row show
 * nothing, a malformed row leaves what is there (as in realtime), and a game being published to keeps its
 * optimistic value.
 */
export function applyStages(rows: StageRow[]): void {
  const store = useStageStore()
  const games = useGamesStore()
  const seen = new Set<string>()
  for (const row of rows) {
    seen.add(row.id)
    rowSeen.add(row.id)
    if (!games.byId(row.id)) continue
    if (writer.busy(row.id)) {
      setAside(row)
      continue
    }
    const stage = stageFromRow(row)
    if (!stage) continue
    noteApplied(row.id)
    store.set(stage, 'load')
  }
  for (const id of Object.keys(store.byGame)) {
    if (seen.has(id) || writer.busy(id)) continue
    noteApplied(id)
    store.remove(id)
  }
}
