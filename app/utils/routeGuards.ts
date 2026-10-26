import type { RouteLocationRaw } from 'vue-router'
import type { Character } from '@/types/character'
import type { CharacterMeta } from '@/types/game'
import { createLogger } from '@/utils/logger'
import { partyLocation } from '@/utils/scope'

const log = createLogger('router')

type GetById = (id: string) => Character | undefined
type MetaOf = (id: string) => CharacterMeta | undefined

function splitIds(ids: string | undefined): string[] {
  return (ids ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

function isOpenable(c: Character | undefined): c is Character {
  return !!c && c.status !== 'draft'
}

// dataReady is false while the online load has failed: a deep link must not be thrown away
// before the data it points at could be loaded.
export function partyGuard(
  ids: string | undefined,
  getById: GetById,
  dataReady = true,
  allowed: (c: Character) => boolean = () => true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const list = splitIds(ids)
  const valid = list.filter(id => {
    const c = getById(id)
    return isOpenable(c) && allowed(c)
  })
  if (valid.length === 0) {
    log.warn('guard:party → redirect', { ids: ids ?? '', reason: 'no valid characters' })
    return { name: 'character-list' }
  }
  if (valid.length !== list.length) {
    return { name: 'party', params: { ids: valid.join(',') } }
  }
}

/**
 * Online, /party is the table of free characters. A link whose first character is in a game opens
 * that game's table instead, with the listed characters of the same game.
 */
export function partyGameRedirect(
  ids: string | undefined,
  getById: GetById,
  metaOf: MetaOf,
  dataReady = true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const list = splitIds(ids).filter(id => isOpenable(getById(id)))
  const gameId = list.length > 0 ? metaOf(list[0]!)?.game ?? '' : ''
  if (!gameId) return undefined
  const inGame = list.filter(id => metaOf(id)?.game === gameId)
  return { name: 'game-party', params: { gameId, ids: inGame.join(',') } }
}

export function gameGuard(
  gameId: string,
  isMember: (id: string) => boolean,
  dataReady = true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  if (!gameId || !isMember(gameId)) {
    log.warn('guard:game → redirect', { gameId, reason: 'not a member' })
    return { name: 'character-list' }
  }
}

/** Game settings: the master only. A player goes back to the game's table, anyone else home. */
export function gameSettingsGuard(
  gameId: string,
  isMember: (id: string) => boolean,
  isMaster: (id: string) => boolean,
  dataReady = true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const toHome = gameGuard(gameId, isMember, dataReady)
  if (toHome) return toHome
  if (!isMaster(gameId)) {
    log.warn('guard:game-settings → redirect', { gameId, reason: 'not the master' })
    return { name: 'game', params: { gameId } }
  }
}

/** Keeps only the game's own non-draft characters; with none left, the table stays open without a sheet. */
export function gamePartyGuard(
  gameId: string,
  ids: string | undefined,
  getById: GetById,
  metaOf: MetaOf,
  dataReady = true,
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const list = splitIds(ids)
  const valid = list.filter(id => isOpenable(getById(id)) && metaOf(id)?.game === gameId)
  if (valid.length === 0) {
    log.warn('guard:game-party → redirect', { gameId, ids: ids ?? '', reason: 'no characters of this game' })
    return { name: 'game', params: { gameId } }
  }
  if (valid.length !== list.length) {
    return { name: 'game-party', params: { gameId, ids: valid.join(',') } }
  }
}

/**
 * A character the player cannot edit (a teammate's) goes back to its sheet on its table: `gameOf` gives
 * its game, '' for a free character.
 */
export function levelUpGuard(
  id: string,
  getById: GetById,
  dataReady = true,
  canEdit: (id: string) => boolean = () => true,
  gameOf: (id: string) => string = () => '',
): RouteLocationRaw | undefined {
  if (!dataReady) return undefined
  const char = getById(id)
  if (!char || char.status !== 'active') {
    log.warn('guard:level-up → redirect', { id, reason: !char ? 'not found' : 'not active' })
    return { name: 'character-list' }
  }
  if (!canEdit(id)) {
    log.warn('guard:level-up → redirect', { id, reason: 'read-only' })
    const gameId = gameOf(id)
    return partyLocation(gameId ? { kind: 'game', gameId } : { kind: 'solo' }, [id])
  }
}
