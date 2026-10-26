import type { Character } from '@/types/character'

export function characterCreateBody(c: Character, ownerId: string) {
  return { id: c.id, data: c, owner: ownerId }
}

export function eventCreateBody<T extends { id: string; characterId: string }>(e: T) {
  return { id: e.id, data: e, character_id: e.characterId, character: e.characterId }
}
