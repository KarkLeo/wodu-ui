import type { Character } from '@/types/character'
import type { LevelUpPatch } from './commands'

export function gainXp(char: Character, amount: number): Character {
  return { ...char, xp: Math.max(0, char.xp + amount) }
}

export function levelUp(char: Character, patch: LevelUpPatch): Character {
  return {
    ...char,
    level: patch.level,
    maxHp: patch.maxHp,
    currentHp: patch.currentHp,
    hitDice: patch.hitDice,
    hpHistory: patch.hpHistory,
    skillIds: patch.skillIds,
    abilityIds: patch.abilityIds,
    stats: patch.stats,
    damageBonusDice: patch.damageBonusDice,
    ...(patch.magic !== undefined ? { magic: patch.magic } : {}),
  }
}
