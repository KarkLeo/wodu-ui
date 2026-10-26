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

const GAME_ROUTES = new Set(['game', 'game-party', 'game-character-new'])

/** The table a route opens. Offline mode has no games, so it always stays home. */
export function scopeForRoute(name: string | undefined, gameId: string | undefined, online: boolean): Scope {
  if (!online) return { kind: 'home' }
  if (name && GAME_ROUTES.has(name) && gameId) return { kind: 'game', gameId }
  if (name === 'party') return { kind: 'solo' }
  return { kind: 'home' }
}
