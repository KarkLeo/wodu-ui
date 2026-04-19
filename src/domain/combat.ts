import type { Character } from '@/types/character'

export function applyDamage(char: Character, amount: number): Character {
  return { ...char, currentHp: Math.max(0, char.currentHp - amount) }
}

export function heal(char: Character, amount: number): Character {
  return { ...char, currentHp: Math.min(char.maxHp, char.currentHp + amount) }
}
