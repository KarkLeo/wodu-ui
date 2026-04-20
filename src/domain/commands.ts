import type { InventoryItem, Magic, Stats, SkillId, AbilityId } from '@/types/character'

export interface LevelUpPatch {
  level: number
  maxHp: number
  currentHp: number
  hitDice: number
  hpHistory: NonNullable<import('@/types/character').Character['hpHistory']>
  skillIds: SkillId[]
  abilityIds: AbilityId[]
  stats: Stats
  damageBonusDice: number
}

export type CharacterCommand =
  // Инвентарь
  | { type: 'BUY_ITEM'; templateId: string }
  | { type: 'RECEIVE_ITEM'; item: Omit<InventoryItem, 'id'> }
  | { type: 'ADD_CUSTOM_ITEM'; name: string; price?: number }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'USE_ITEM'; itemId: string }
  | { type: 'EQUIP_ITEM'; itemId: string }
  | { type: 'UNEQUIP_ITEM'; itemId: string }
  | { type: 'SET_COINS'; amount: number }
  // Боевые
  | { type: 'APPLY_DAMAGE'; amount: number }
  | { type: 'HEAL'; amount: number }
  // Прогрессия
  | { type: 'GAIN_XP'; amount: number }
  | { type: 'LEVEL_UP'; patch: LevelUpPatch }
  // Разное
  | { type: 'UPDATE_MAGIC'; magic: Magic }
  | { type: 'UPDATE_STATS'; stats: Stats }
  | { type: 'UPDATE_NOTES'; notes: string }
  | { type: 'DRINK_QUICKSILVER' }
  | { type: 'RESET_QUICKSILVER' }
