import { ClientResponseError } from 'pocketbase'
import { pb, type MonsterRow } from '@/transport/pb'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { checkMonster } from '@/domain/library'
import { useLibraryStore } from '@/stores/library'
import type { LibraryMonster } from '@/types/library'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:library')

function toMonster(row: MonsterRow): LibraryMonster | null {
  const check = checkMonster(row.data)
  if (!check.ok || check.value.id !== row.id) {
    log.warn('dropping a monster that fails the shape check', { id: row.id })
    return null
  }
  return check.value
}

// Write paths refuse what the shape check refuses; the form checks first, so this is a developer error.
function checked(monster: LibraryMonster): LibraryMonster {
  const check = checkMonster(monster)
  if (!check.ok) throw new Error(`invalid monster: ${check.problems.map(p => `${p.field}:${p.key}`).join(', ')}`)
  return check.value
}

/**
 * Master: loads the game's monsters into the library store. A failure leaves the store `failed`
 * (the screen offers a retry) and is not rethrown.
 */
export async function loadMonsters(gameId: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const library = useLibraryStore()
  library.startLoading(gameId)
  try {
    const rows = await call(() => pb.collection('monsters').getFullList<MonsterRow>({
      filter: pb.filter('game = {:g}', { g: gameId }),
    }))
    if (!current() || library.gameId !== gameId) return
    library.setMonsters(gameId, rows.map(toMonster).filter((m): m is LibraryMonster => m !== null))
  } catch (err) {
    log.warn('loadMonsters failed', { gameId, err })
    if (current()) library.setFailed(gameId)
  }
}

/** Master: adds a monster to the game's library. */
export async function createMonster(gameId: string, monster: LibraryMonster): Promise<void> {
  requireOnlineUser()
  const data = checked(monster)
  const current = staysCurrent()
  await call(() => pb.collection('monsters').create({ id: data.id, game: gameId, data }))
  if (current()) useLibraryStore().upsertMonster(gameId, data)
}

/** Master: replaces a monster's entry; its game never changes. */
export async function updateMonster(gameId: string, monster: LibraryMonster): Promise<void> {
  requireOnlineUser()
  const data = checked(monster)
  const current = staysCurrent()
  await call(() => pb.collection('monsters').update(data.id, { data }))
  if (current()) useLibraryStore().upsertMonster(gameId, data)
}

/** Master: deletes a monster. One that is already gone counts as deleted. */
export async function deleteMonster(id: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  try {
    await call(() => pb.collection('monsters').delete(id))
  } catch (err) {
    if (!(err instanceof ClientResponseError && err.status === 404)) throw err
  }
  if (current()) useLibraryStore().removeMonster(id)
}
