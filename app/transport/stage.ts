import { pb, type StageRow } from '@/transport/pb'
import { requireOnlineUser } from './onlineOps'
import { serialWriter } from './serialWriter'
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

// The row exists only once the master has published; a refused create means it appeared meanwhile.
async function send(gameId: string, stage: Stage): Promise<void> {
  const rows = pb.collection('stages')
  try {
    await rows.update(gameId, { data: stage })
  } catch (err) {
    if (statusOf(err) !== 404) throw err
    try {
      await rows.create({ id: gameId, game: gameId, data: stage })
    } catch (createErr) {
      if (statusOf(createErr) !== 400) throw createErr
      await rows.update(gameId, { data: stage })
    }
  }
}

interface Waiter { resolve: () => void; reject: (err: unknown) => void }
const waiters = new Map<string, Waiter[]>()

const writer = serialWriter<Stage>({
  show: stage => useStageStore().set(stage),
  // A game forgotten meanwhile must not get its stage back.
  restore: (_key, stage) => {
    if (useGamesStore().byId(stage.id)) useStageStore().set(stage)
  },
  send,
  message: () => t('errors.stageFailed'),
  settled: (key, error) => {
    const list = waiters.get(key) ?? []
    waiters.delete(key)
    for (const w of list) {
      if (error === null) w.resolve()
      else w.reject(error)
    }
  },
})

/** Master: makes `next` live. Optimistic; writes run one after another per game and only the newest waits; a failure restores the last confirmed stage and rethrows. */
export async function publishStage(next: Stage): Promise<void> {
  requireOnlineUser()
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
  const store = useStageStore()
  if (writer.busy(row.id)) return
  if (action === 'delete') {
    store.remove(row.id)
    return
  }
  const stage = stageFromRow(row)
  if (stage) store.set(stage)
}

/** A fresh snapshot of every readable row: games without a row show nothing, and a game being published to keeps its optimistic value. */
export function applyStages(rows: StageRow[]): void {
  const store = useStageStore()
  const seen = new Set<string>()
  for (const row of rows) {
    seen.add(row.id)
    if (writer.busy(row.id)) continue
    const stage = stageFromRow(row)
    if (stage) store.set(stage)
    else store.remove(row.id)
  }
  for (const id of Object.keys(store.byGame)) {
    if (!seen.has(id) && !writer.busy(id)) store.remove(id)
  }
}
