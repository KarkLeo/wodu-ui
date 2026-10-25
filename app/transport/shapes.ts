import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

export function isCharacterShape(c: unknown): c is Character {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.inventory) &&
    typeof o.maxHp === 'number' &&
    !!o.stats &&
    typeof o.stats === 'object'
  )
}

export function isRollRecordShape(r: unknown): r is RollRecord {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.notation === 'string' &&
    Array.isArray(o.dice) &&
    typeof o.total === 'number'
  )
}

export function isChangeEntryShape(e: unknown): e is ChangeEntry {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.characterId === 'string' &&
    !!o.payload &&
    typeof o.payload === 'object'
  )
}
