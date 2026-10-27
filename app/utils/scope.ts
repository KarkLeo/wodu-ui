import type { RouteLocationRaw } from 'vue-router'
import type { Character } from '@/types/character'
import type { CharacterMeta, Scope } from '@/types/game'

export function charactersInScope(
  list: Character[],
  meta: Record<string, CharacterMeta>,
  scope: Scope,
  me: string | null,
): Character[] {
  return list.filter((c) => {
    const m = meta[c.id]
    if (!m) return false
    if (scope.kind === 'game') return m.game === scope.gameId
    return me !== null && m.owner === me && m.game === ''
  })
}

export function eventInScope(row: { character: string; game: string }, scope: Scope): boolean {
  if (scope.kind === 'game') return row.game === scope.gameId
  if (scope.kind === 'solo') return row.game === ''
  return false
}

export function eventFilter(scope: Scope): string | null {
  if (scope.kind === 'game') return `game = ${JSON.stringify(scope.gameId)}`
  if (scope.kind === 'solo') return 'game = ""'
  return null
}

const GAME_ROUTES = new Set(['game', 'game-party', 'game-character-new', 'game-settings'])

/**
 * The table a route opens. Offline mode has no games, so it always stays home. The level-up route
 * carries no game id: it takes the table of its character's game (`characterGame`, '' when the
 * character is free or its game is not one the player knows).
 */
export function scopeForRoute(
  name: string | undefined,
  gameId: string | undefined,
  online: boolean,
  characterGame = '',
): Scope {
  if (!online) return { kind: 'home' }
  if (name && GAME_ROUTES.has(name) && gameId) return { kind: 'game', gameId }
  if (name === 'party') return { kind: 'solo' }
  if (name === 'level-up') return characterGame ? { kind: 'game', gameId: characterGame } : { kind: 'solo' }
  return { kind: 'home' }
}

/**
 * A game this player no longer knows (left, removed or deleted) counts as no game: the server's unset
 * of `game` may never reach the client, e.g. for a deleted game.
 */
export function freeIfGameUnknown(
  meta: CharacterMeta | undefined,
  isKnownGame: (id: string) => boolean,
): CharacterMeta | undefined {
  if (!meta || meta.game === '' || isKnownGame(meta.game)) return meta
  return { ...meta, game: '' }
}

/** Where a guard sends someone it turns away: the games online, the offline table offline. */
export function homeLocation(offline: boolean): RouteLocationRaw {
  return offline ? { name: 'offline' } : { name: 'games' }
}

/**
 * The table with no sheet open: a game's own table, the offline table, or, outside games, the characters
 * page that lists the free characters.
 */
export function tableLocation(scope: Scope, offline = false): RouteLocationRaw {
  if (offline) return { name: 'offline' }
  return scope.kind === 'game' ? { name: 'game', params: { gameId: scope.gameId } } : { name: 'characters' }
}

/**
 * The players panel's "Home": a game table and an invite page to the games, the free-characters table to
 * the characters, offline to the landing.
 */
export function panelHomeLocation(scope: Scope, offline = false, routeName?: string): RouteLocationRaw {
  if (offline) return { name: 'landing' }
  return scope.kind === 'game' || routeName === 'join' ? { name: 'games' } : { name: 'characters' }
}

/** Open sheets stay on their table: a game's party route inside a game, the party route outside, /offline offline. */
export function partyLocation(scope: Scope, ids: string[], offline = false): RouteLocationRaw {
  if (ids.length === 0) return tableLocation(scope, offline)
  const joined = ids.join(',')
  if (offline) return { name: 'offline-party', params: { ids: joined } }
  return scope.kind === 'game'
    ? { name: 'game-party', params: { gameId: scope.gameId, ids: joined } }
    : { name: 'party', params: { ids: joined } }
}

/** The creation wizard of the table: in the game, outside games, or offline. */
export function newCharacterLocation(scope: Scope, offline = false): RouteLocationRaw {
  if (offline) return { name: 'offline-character-new' }
  return scope.kind === 'game' ? { name: 'game-character-new', params: { gameId: scope.gameId } } : { name: 'character-new' }
}

export function levelUpLocation(id: string, offline = false): RouteLocationRaw {
  return { name: offline ? 'offline-level-up' : 'level-up', params: { id } }
}
