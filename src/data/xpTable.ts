import type { StatKey } from '@/types/character'

export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 1000,
  3: 3000,
  4: 6000,
  5: 10000,
  6: 15000,
  7: 21000,
  8: 28000,
  9: 36000,
  10: 45000,
}

export interface LevelReward {
  level: number
  hitDice?: number
  skills?: number
  abilities?: number
  statBonus?: number
  damageDice?: number
}

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 2,  hitDice: 1 },
  { level: 3,  skills: 1, abilities: 1 },
  { level: 4,  hitDice: 1, statBonus: 1 },
  { level: 5,  damageDice: 1 },
  { level: 6,  hitDice: 1, skills: 1, abilities: 1 },
  { level: 7,  statBonus: 1 },
  { level: 8,  hitDice: 1 },
  { level: 9,  skills: 1, abilities: 1 },
  { level: 10, hitDice: 1, statBonus: 1, damageDice: 1 },
]

export function getReward(level: number): LevelReward | undefined {
  return LEVEL_REWARDS.find(r => r.level === level)
}

export const MAX_STAT_BONUS = 3
export const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
