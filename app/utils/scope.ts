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

/** The table with no sheet open: a game's own table, or home outside a game. */
export function tableLocation(scope: Scope): RouteLocationRaw {
  return scope.kind === 'game' ? { name: 'game', params: { gameId: scope.gameId } } : { name: 'character-list' }
}

/** Open sheets stay on their table: a game's party route inside a game, the party route outside. */
export function partyLocation(scope: Scope, ids: string[]): RouteLocationRaw {
  if (ids.length === 0) return tableLocation(scope)
  const joined = ids.join(',')
  return scope.kind === 'game'
    ? { name: 'game-party', params: { gameId: scope.gameId, ids: joined } }
    : { name: 'party', params: { ids: joined } }
}
