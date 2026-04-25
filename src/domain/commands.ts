import type { InventoryItem, Magic, Stats, SkillId, AbilityId, StatKey } from '@/types/character'

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
  magic?: Magic
}

export type CharacterCommand =
  // Инвентарь
  | { type: 'BUY_ITEM'; templateId: string }
  | { type: 'RECEIVE_ITEM'; item: Omit<InventoryItem, 'id'> }
  | { type: 'ADD_CUSTOM_ITEM'; name: string; price?: number; notes?: string; consumable?: boolean; quantity?: number }
  | { type: 'EDIT_CUSTOM_ITEM'; itemId: string; name: string; price?: number; notes?: string; consumable?: boolean; quantity?: number }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'USE_ITEM'; itemId: string }
  | { type: 'EQUIP_ITEM'; itemId: string }
  | { type: 'UNEQUIP_ITEM'; itemId: string }
  | { type: 'SET_COINS'; amount: number }
  // Боевые
  | { type: 'APPLY_DAMAGE'; amount: number }
  | { type: 'HEAL'; amount: number }
  | { type: 'SET_TEMP_HP'; amount: number }
  | { type: 'SET_ARMOR_MOD'; amount: number }
  | { type: 'SET_DAMAGE_MOD'; amount: number }
  // Прогрессия
  | { type: 'GAIN_XP'; amount: number }
  | { type: 'LEVEL_UP'; patch: LevelUpPatch }
  // Модификаторы характеристик (временные баффы/дебаффы)
  | { type: 'ADD_STAT_MODIFIER'; statKey: StatKey; amount: number; label: string }
  | { type: 'REMOVE_STAT_MODIFIER'; modifierId: string }
  | { type: 'CLEAR_STAT_MODIFIERS'; statKey?: StatKey }
  // Разное
  | { type: 'UPDATE_MAGIC'; magic: Magic }
  | { type: 'UPDATE_STATS'; stats: Stats }
  | { type: 'UPDATE_NOTES'; notes: string }
  | { type: 'RESET_QUICKSILVER' }
  | { type: 'FINALIZE_CHARACTER' }
