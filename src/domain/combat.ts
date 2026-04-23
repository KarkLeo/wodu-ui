import type { Character } from '@/types/character'

export function applyDamage(char: Character, amount: number): Character {
  const safe = Math.max(0, amount)
  return { ...char, currentHp: Math.max(0, char.currentHp - safe) }
}

export function heal(char: Character, amount: number): Character {
  const safe = Math.max(0, amount)
  return { ...char, currentHp: Math.min(char.maxHp, char.currentHp + safe) }
}
