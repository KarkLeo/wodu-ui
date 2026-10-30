import { ClientResponseError } from 'pocketbase'
import { pb, type GameRow, type ItemRow, type MonsterRow } from '@/transport/pb'
import { call, requireOnlineUser, staysCurrent } from './onlineOps'
import { checkItem, checkMonster, type LibraryCheck } from '@/domain/library'
import { toGame } from './games'
import { useGamesStore } from '@/stores/games'
import { useLibraryStore } from '@/stores/library'
import type { LibraryItem, LibraryMonster } from '@/types/library'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:library')

interface Entry { id: string }

interface Kind<T extends Entry> {
  collection: 'monsters' | 'items'
  label: string
  check: (value: unknown) => LibraryCheck<T>
  set: (gameId: string, entries: T[]) => void
  upsert: (gameId: string, entry: T) => void
  remove: (id: string) => void
}

const MONSTERS: Kind<LibraryMonster> = {
  collection: 'monsters',
  label: 'monster',
  check: checkMonster,
  set: (g, e) => useLibraryStore().setMonsters(g, e),
  upsert: (g, e) => useLibraryStore().upsertMonster(g, e),
  remove: id => useLibraryStore().removeMonster(id),
}
const ITEMS: Kind<LibraryItem> = {
  collection: 'items',
  label: 'item',
  check: checkItem,
  set: (g, e) => useLibraryStore().setItems(g, e),
  upsert: (g, e) => useLibraryStore().upsertItem(g, e),
  remove: id => useLibraryStore().removeItem(id),
}

function fromRow<T extends Entry>(kind: Kind<T>, row: { id: string; data: unknown }): T | null {
  const check = kind.check(row.data)
  if (!check.ok || check.value.id !== row.id) {
    log.warn(`dropping a ${kind.label} that fails the shape check`, { id: row.id })
    return null
  }
  return check.value
}

// Write paths refuse what the shape check refuses; the form checks first, so this is a developer error.
function checked<T extends Entry>(kind: Kind<T>, entry: T): T {
  const check = kind.check(entry)
  if (!check.ok) throw new Error(`invalid ${kind.label}: ${check.problems.map(p => `${p.field}:${p.key}`).join(', ')}`)
  return check.value
}

// A failure leaves the store `failed` (the screen offers a retry) and is not rethrown.
async function load<T extends Entry>(kind: Kind<T>, gameId: string): Promise<void> {
  requireOnlineUser()
  const current = staysCurrent()
  const library = useLibraryStore()
  library.startLoading(gameId, kind.collection)
  try {
    const rows = await call(() => pb.collection(kind.collection).getFullList<MonsterRow | ItemRow>({
      filter: pb.filter('game = {:g}', { g: gameId }),
    }))
    if (!current() || library.gameId !== gameId) return
    kind.set(gameId, rows.map(r => fromRow(kind, r)).filter((e): e is T => e !== null))
  } catch (err) {
    log.warn(`load ${kind.collection} failed`, { gameId, err })
    if (current()) library.setFailed(gameId, kind.collection)
  }
}

async function create<T extends Entry>(kind: Kind<T>, gameId: string, entry: T): Promise<void> {
  requireOnlineUser()
  const data = checked(kind, entry)
  const current = staysCurrent()
  await call(() => pb.collection(kind.collection).create({ id: data.id, game: gameId, data }))
  if (current()) kind.upsert(gameId, data)
}

async function update<T extends Entry>(kind: Kind<T>, gameId: string, entry: T): Promise<void> {
  requireOnlineUser()
  const data = checked(kind, entry)
  const current = staysCurrent()
  await call(() => pb.collection(kind.collection).update(data.id, { data }))
  if (current()) kind.upsert(gameId, data)
}

/**
 * The server answers 404 both for an entry that is already gone and for a player who is no longer the
 * master, so a 404 re-reads the game: still the master, the entry counts as deleted; otherwise the game
 * (with its new master) goes into the store and the delete fails.
 */
async function remove(kind: Kind<LibraryMonster> | Kind<LibraryItem>, gameId: string, id: string): Promise<void> {
  const me = requireOnlineUser()
  const current = staysCurrent()
  try {
    await call(() => pb.collection(kind.collection).delete(id))
  } catch (err) {
    if (!(err instanceof ClientResponseError && err.status === 404)) throw err
    const game = toGame(await call(() => pb.collection('games').getOne<GameRow>(gameId)))
    if (game.master !== me) {
      if (current()) useGamesStore().upsertGame(game)
      throw err
    }
  }
  if (current()) kind.remove(id)
}

/** Master: loads the game's monsters into the library store. */
export const loadMonsters = (gameId: string) => load(MONSTERS, gameId)
/** Master: adds a monster to the game's library. */
export const createMonster = (gameId: string, monster: LibraryMonster) => create(MONSTERS, gameId, monster)
/** Master: replaces a monster's entry; its game never changes. */
export const updateMonster = (gameId: string, monster: LibraryMonster) => update(MONSTERS, gameId, monster)
/** Master: deletes a monster. */
export const deleteMonster = (gameId: string, id: string) => remove(MONSTERS, gameId, id)

/** Master: loads the game's items into the library store. */
export const loadItems = (gameId: string) => load(ITEMS, gameId)
/** Master: adds an item to the game's library. */
export const createItem = (gameId: string, item: LibraryItem) => create(ITEMS, gameId, item)
/** Master: replaces an item's entry; its game never changes. */
export const updateItem = (gameId: string, item: LibraryItem) => update(ITEMS, gameId, item)
/** Master: deletes an item. */
export const deleteItem = (gameId: string, id: string) => remove(ITEMS, gameId, id)
