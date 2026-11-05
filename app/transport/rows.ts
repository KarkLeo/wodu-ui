import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'

export function characterCreateBody(c: Character, ownerId: string, game = '') {
  return { id: c.id, data: c, owner: ownerId, game }
}

export function eventCreateBody<T extends { id: string; characterId: string }>(e: T, game = '') {
  return { id: e.id, data: e, character_id: e.characterId, character: e.characterId, game }
}

// A monster has no character record: the instance id stands in as character_id and the link stays empty.
export function monsterRollBody(r: RollRecord, game: string) {
  return { id: r.id, data: r, character_id: r.characterId, character: '', game }
}
