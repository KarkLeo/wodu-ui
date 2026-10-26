import type { Character } from '@/types/character'

export function characterCreateBody(c: Character, ownerId: string, game = '') {
  return { id: c.id, data: c, owner: ownerId, game }
}

export function eventCreateBody<T extends { id: string; characterId: string }>(e: T, game = '') {
  return { id: e.id, data: e, character_id: e.characterId, character: e.characterId, game }
}
