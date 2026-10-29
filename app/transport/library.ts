import { ClientResponseError } from 'pocketbase'
import { pb, type GameRow, type MonsterRow } from '@/transport/pb'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { checkMonster } from '@/domain/library'
import { toGame } from './games'
import { useGamesStore } from '@/stores/games'
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

/**
 * Master: deletes a monster. The server answers 404 both for an entry that is already gone and for a
 * player who is no longer the master, so a 404 re-reads the game: still the master, the entry counts as
 * deleted; otherwise the game (with its new master) goes into the store and the delete fails.
 */
export async function deleteMonster(gameId: string, id: string): Promise<void> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  try {
    await call(() => pb.collection('monsters').delete(id))
  } catch (err) {
    if (!(err instanceof ClientResponseError && err.status === 404)) throw err
    const game = toGame(await call(() => pb.collection('games').getOne<GameRow>(gameId)))
    if (game.master !== me) {
      if (current()) useGamesStore().upsertGame(game)
      throw err
    }
  }
  if (current()) useLibraryStore().removeMonster(id)
}
