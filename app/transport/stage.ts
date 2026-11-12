import { pb, type StageRow } from '@/transport/pb'
import { requireOnlineUser } from './onlineOps'
import { serialWriter, WriteDropped } from './serialWriter'
export { WriteDropped }
import { checkStage } from '@/domain/stage'
import { useStageStore } from '@/stores/stage'
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

const writer = serialWriter<Stage>({
  show: stage => useStageStore().set(stage),
  // A game forgotten meanwhile must not get its stage back.
  restore: (_key, stage) => {
    if (useGamesStore().byId(stage.id)) useStageStore().set(stage)
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
  },
})

/**
 * Master: makes `next` live. Optimistic; writes run one after another per game and only the newest waits; a
 * failure restores the last confirmed stage and rethrows. Rejects with `WriteDropped` (not a failure: the
 * server may have accepted it) when the mode or the user changed before the write finished. Swallows nothing.
 */
export async function publishStage(next: Stage, options: { quiet?: boolean } = {}): Promise<void> {
  requireOnlineUser()
  quiet.set(next.id, options.quiet === true)
  const prior = useStageStore().stageOf(next.id)
  await new Promise<void>((resolve, reject) => {
    const list = waiters.get(next.id) ?? []
    list.push({ resolve, reject })
    waiters.set(next.id, list)
    writer.submit(next.id, prior, next)
  })
}

// While my own publish for a game is pending, an older echo of it must not undo the newer optimistic value.
export function receiveStage(action: string, row: StageRow): void {
  if (action === 'delete') rowSeen.delete(row.id)
  else rowSeen.add(row.id)
  const store = useStageStore()
  if (writer.busy(row.id) || !useGamesStore().byId(row.id)) return
  if (action === 'delete') {
    store.remove(row.id)
    return
  }
  const stage = stageFromRow(row)
  if (stage) store.set(stage)
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
    if (writer.busy(row.id) || !games.byId(row.id)) continue
    const stage = stageFromRow(row)
    if (stage) store.set(stage)
  }
  for (const id of Object.keys(store.byGame)) {
    if (!seen.has(id) && !writer.busy(id)) store.remove(id)
  }
}
