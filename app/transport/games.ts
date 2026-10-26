import { ClientResponseError } from 'pocketbase'
import { pb, type CharacterRow, type GameMemberRow, type GameRow } from '@/transport/pb'
import { currentUser } from './auth'
import { guard } from './backend'
import { BOOTSTRAP_TIMEOUT_MS, withTimeout } from './connection'
import { mode, modeSession } from './mode'
import { scope } from './scope'
import { isCharacterShape } from './shapes'
import { useGamesStore } from '@/stores/games'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { generateInviteCode } from '@/utils/inviteCode'
import type { Game, GameMember } from '@/types/game'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:games')

const CODE_ATTEMPTS = 5

/** Thrown by claimMaster() when another member became master first. */
export class MasterTakenError extends Error {
  constructor() {
    super('another member is already the master')
    this.name = 'MasterTakenError'
  }
}

export function toGame(row: GameRow): Game {
  return { id: row.id, name: String(row.name ?? ''), master: String(row.master ?? ''), inviteCode: String(row.invite_code ?? '') }
}

export function toMember(row: GameMemberRow): GameMember {
  return { id: row.id, game: row.game, user: row.user, name: String(row.expand?.user?.name ?? '') }
}

// A hanging server must not leave a button spinning: a timeout counts as a network failure.
function call<T>(op: () => Promise<T>): Promise<T> {
  return guard(() => withTimeout(op(), BOOTSTRAP_TIMEOUT_MS))
}

function me(): string {
  const id = currentUser.value?.id
  if (mode.value !== 'online' || !id) throw new Error('games: needs a signed-in online session')
  return id
}

// Work that finishes after a mode switch or a sign-out must not touch the stores of the next session.
function staysCurrent(): () => boolean {
  const session = modeSession()
  const user = currentUser.value?.id ?? null
  return () => modeSession() === session && (currentUser.value?.id ?? null) === user
}

// Invite codes are credentials, so they come from the crypto source rather than Math.random.
function newInviteCode(): string {
  return generateInviteCode(() => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32)
}

function isInviteCodeTaken(err: unknown): boolean {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return false
  const data = err.response?.data as { invite_code?: { code?: string } } | undefined
  return data?.invite_code?.code === 'validation_not_unique'
}

// invite_code is unique on the server; a collision with another game's code is retried with a new one.
async function withFreshCode<T>(write: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const code = newInviteCode()
    try {
      return await write(code)
    } catch (err) {
      if (!isInviteCodeTaken(err) || attempt >= CODE_ATTEMPTS) throw err
      log.warn('invite code taken, retrying', { attempt })
    }
  }
}

function memberRowOf(gameId: string, userId: string): GameMember | undefined {
  return useGamesStore().members.find(m => m.game === gameId && m.user === userId)
}

async function findMemberRowId(gameId: string, userId: string): Promise<string> {
  const known = memberRowOf(gameId, userId)
  if (known) return known.id
  const row = await call(() => pb.collection('game_members').getFirstListItem<GameMemberRow>(
    pb.filter('game = {:g} && user = {:u}', { g: gameId, u: userId }),
  ))
  return row.id
}

/**
 * Forgets a game this player can no longer read: the game, its members, other players' characters in
 * it and, when it is the open table, its events. The server sends no delete for those records. My own
 * characters there become free.
 */
export function forgetGame(gameId: string): void {
  const s = scope.value
  const self = currentUser.value?.id ?? null
  const characters = useCharactersStore()
  useGamesStore().removeGame(gameId)
  characters.removeGameOthers(gameId, self)
  characters.freeGame(gameId, self)
  if (s.kind === 'game' && s.gameId === gameId) {
    useRollHistoryStore().clearAll()
    useChangeLogStore().clearAll()
  }
}

/** Loads a game the player has just joined: the game, its members and its characters. */
export async function loadGame(gameId: string): Promise<void> {
  const current = staysCurrent()
  const [gameRow, memberRows, charRows] = await call(() => Promise.all([
    pb.collection('games').getOne<GameRow>(gameId),
    pb.collection('game_members').getFullList<GameMemberRow>({ filter: pb.filter('game = {:g}', { g: gameId }), expand: 'user' }),
    pb.collection('characters').getFullList<CharacterRow>({ filter: pb.filter('game = {:g}', { g: gameId }) }),
  ]))
  if (!current()) return
  const games = useGamesStore()
  const characters = useCharactersStore()
  games.upsertGame(toGame(gameRow))
  for (const row of memberRows) games.upsertMember(toMember(row))
  for (const row of charRows) {
    if (!isCharacterShape(row.data)) continue
    characters.upsertLocal(row.data, row.updated, { owner: row.owner, game: row.game })
  }
}

/** The game behind an invite code, or null for an unknown or reset code. Works signed out too. */
export async function findGameByCode(code: string): Promise<Game | null> {
  const { items } = await call(() => pb.collection('games').getList<GameRow>(1, 1, {
    filter: pb.filter('invite_code = {:code}', { code }),
    // The credential the list rule checks; without it a non-member gets an empty list.
    query: { code },
  }))
  return items[0] ? toGame(items[0]) : null
}

/** Creates a game with the player as its master, then the master's own membership. */
export async function createGame(name: string): Promise<Game> {
  const master = me()
  const current = staysCurrent()
  const id = crypto.randomUUID()
  const row = await withFreshCode(code => call(() =>
    pb.collection('games').create<GameRow>({ id, name, master, invite_code: code }),
  ))
  const game = toGame(row)
  const games = useGamesStore()
  // Known before the membership lands, so its realtime echo does not load the game a second time.
  if (current()) games.upsertGame(game)
  let memberRow: GameMemberRow
  try {
    memberRow = await call(() => pb.collection('game_members').create<GameMemberRow>({ game: id, user: master }, { expand: 'user' }))
  } catch (err) {
    if (current()) games.removeGame(id)
    // Without the membership the master cannot even read the game, so do not leave it behind.
    await call(() => pb.collection('games').delete(id)).catch((cleanupErr: unknown) => {
      log.error('createGame: could not delete the game after a failed membership', { id, err: cleanupErr })
    })
    throw err
  }
  if (current()) {
    games.upsertMember({ ...toMember(memberRow), name: memberRow.expand?.user?.name ?? currentUser.value?.name ?? '' })
  }
  return game
}

/** Joins a game found by its code, then loads its table. */
export async function joinGame(game: Game, code: string): Promise<void> {
  const user = me()
  const current = staysCurrent()
  const games = useGamesStore()
  if (memberRowOf(game.id, user)) return
  // Known before the membership lands, so the realtime echo of the membership does not load it a second time.
  const known = !!games.byId(game.id)
  if (!known) games.upsertGame(game)
  let row: GameMemberRow
  try {
    row = await call(() => pb.collection('game_members').create<GameMemberRow>({ game: game.id, user, code }, { expand: 'user' }))
  } catch (err) {
    if (!known && current()) games.removeGame(game.id)
    throw err
  }
  if (!current()) return
  games.upsertMember({ ...toMember(row), name: row.expand?.user?.name ?? currentUser.value?.name ?? '' })
  await loadGame(game.id)
}

/** Leaves a game: my characters there become free first, then my membership goes. */
export async function leaveGame(gameId: string): Promise<void> {
  const user = me()
  const current = staysCurrent()
  const characters = useCharactersStore()
  const mine = characters.list.filter(c => {
    const m = characters.meta[c.id]
    return m?.game === gameId && m.owner === user
  })
  for (const c of mine) {
    await call(() => pb.collection('characters').update(c.id, { game: '' }))
    if (current()) characters.setMeta(c.id, { owner: user, game: '' })
  }
  const rowId = await findMemberRowId(gameId, user)
  await call(() => pb.collection('game_members').delete(rowId))
  if (current()) forgetGame(gameId)
}

/** Master: removes a member, whose characters there become free and leave the table with them. */
export async function removeMember(gameId: string, userId: string): Promise<void> {
  me()
  const current = staysCurrent()
  const characters = useCharactersStore()
  const theirs = characters.list.filter(c => {
    const m = characters.meta[c.id]
    return m?.game === gameId && m.owner === userId
  })
  for (const c of theirs) {
    await call(() => pb.collection('characters').update(c.id, { game: '' }))
    // A free character of another player is no longer readable.
    if (current()) characters.removeLocal(c.id)
  }
  const rowId = await findMemberRowId(gameId, userId)
  await call(() => pb.collection('game_members').delete(rowId))
  if (current()) useGamesStore().removeMember(rowId)
}

/** Master: replaces the invite code, so the old link and code stop working. */
export async function resetInviteCode(gameId: string): Promise<string> {
  me()
  const current = staysCurrent()
  const row = await withFreshCode(code => call(() =>
    pb.collection('games').update<GameRow>(gameId, { invite_code: code }),
  ))
  const game = toGame(row)
  if (current()) {
    const known = useGamesStore().byId(gameId)
    useGamesStore().upsertGame(known ? { ...known, inviteCode: game.inviteCode } : game)
  }
  return game.inviteCode
}

/** Master: deletes the game. Its characters become free and stay with their owners. */
export async function deleteGame(gameId: string): Promise<void> {
  me()
  const current = staysCurrent()
  await call(() => pb.collection('games').delete(gameId))
  if (current()) forgetGame(gameId)
}

async function rereadGame(gameId: string, current: () => boolean): Promise<Game | null> {
  try {
    const game = toGame(await call(() => pb.collection('games').getOne<GameRow>(gameId)))
    if (current()) useGamesStore().upsertGame(game)
    return game
  } catch (err) {
    log.warn('claimMaster: could not re-read the game', { gameId, err })
    return null
  }
}

/**
 * Becomes the master of a masterless game. Two members may claim at once: the server keeps the last
 * write, so the game is read back, and the member who lost gets MasterTakenError.
 */
export async function claimMaster(gameId: string): Promise<void> {
  const user = me()
  const current = staysCurrent()
  try {
    await call(() => pb.collection('games').update<GameRow>(gameId, { master: user }))
  } catch (err) {
    // The rule allows a claim only while the game has no master: a 404 means someone got there first.
    if (err instanceof ClientResponseError && err.status === 404) {
      const game = await rereadGame(gameId, current)
      if (game?.master === user) return
      if (game && game.master !== '') throw new MasterTakenError()
    }
    throw err
  }
  const game = await rereadGame(gameId, current)
  if (game && game.master !== user) throw new MasterTakenError()
}

/** Moves a character into a game, or out of its game with `''`. */
export async function moveCharacter(characterId: string, gameId: string): Promise<void> {
  const user = me()
  const current = staysCurrent()
  const characters = useCharactersStore()
  await call(() => pb.collection('characters').update(characterId, { game: gameId }))
  if (!current()) return
  const owner = characters.metaOf(characterId)?.owner ?? user
  // The master taking a player's character out of the game can no longer read it.
  if (gameId === '' && owner !== user) characters.removeLocal(characterId)
  else characters.setMeta(characterId, { owner, game: gameId })
}

/** Master: gives one of their characters in the game to a member, who becomes its owner. */
export async function assignCharacter(characterId: string, userId: string): Promise<void> {
  me()
  const current = staysCurrent()
  const characters = useCharactersStore()
  await call(() => pb.collection('characters').update(characterId, { owner: userId }))
  if (!current()) return
  const game = characters.metaOf(characterId)?.game ?? ''
  characters.setMeta(characterId, { owner: userId, game })
}
