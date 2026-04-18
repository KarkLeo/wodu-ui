import type { AbilityId, ArmorState, Character, InventoryItem, StatKey } from '@/types/character'
import { XP_THRESHOLDS } from '@/data/xpTable'

export function totalArmor(char: Pick<Character, 'armor' | 'abilityIds'>): number {
  const base = char.armor.type === 'full' ? 2 : char.armor.type === 'light' ? 1 : 0
  const shield = char.armor.shield ? 1 : 0
  const toughness = (char.abilityIds ?? []).includes('toughness') ? 1 : 0
  return base + shield + toughness
}

export function armorLabel(armor: ArmorState): string {
  const base = armor.type === 'full' ? 'Полный' : armor.type === 'light' ? 'Лёгкий' : 'Без доспеха'
  return armor.shield ? `${base} + щит` : base
}

export function isWeapon(item: InventoryItem): boolean {
  return item.tags.includes('weapon')
}

export function damageFormula(char: Pick<Character, 'abilityIds' | 'damageBonusDice'>, weapon: InventoryItem): string {
  if (!weapon.damage) return '—'
  const bonuses: string[] = []
  const melee = weapon.tags.includes('weapon') && !weapon.tags.includes('ranged')
  const ranged = weapon.tags.includes('ranged')
  const abilityIds = char.abilityIds ?? []
  if (abilityIds.includes('skirmish')) bonuses.push('+1 Манёвр.')
  if (melee && abilityIds.includes('hewing')) bonuses.push('+2 Рубка')
  if (ranged && abilityIds.includes('volley')) bonuses.push('+2 Залп')
  const bonusDice = char.damageBonusDice > 0 ? ` +${char.damageBonusDice}d6` : ''
  const extras = bonuses.length ? ' (' + bonuses.join(', ') + ')' : ''
  return `${weapon.damage}${bonusDice}${extras}`
}

export function xpToNextLevel(char: Pick<Character, 'level' | 'xp'>): number | null {
  if (char.level >= 10) return null
  const next = XP_THRESHOLDS[char.level + 1]
  return Math.max(0, next - char.xp)
}

export function xpProgressPercent(char: Pick<Character, 'level' | 'xp'>): number {
  if (char.level >= 10) return 100
  const current = XP_THRESHOLDS[char.level]
  const next = XP_THRESHOLDS[char.level + 1]
  const span = next - current
  return Math.max(0, Math.min(100, ((char.xp - current) / span) * 100))
}

export function isReadyToLevelUp(char: Pick<Character, 'level' | 'xp'>): boolean {
  if (char.level >= 10) return false
  return char.xp >= XP_THRESHOLDS[char.level + 1]
}

export function hitDiceCount(con: number): number {
  return 1 + Math.max(0, con)
}

export function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6)
}

export function roll2d6(): number {
  return rollD6() + rollD6()
}

export function statBonusFrom2d6(roll: number): number {
  if (roll <= 6) return 0
  if (roll <= 9) return 1
  if (roll <= 11) return 2
  return 3
}

/** Бросает N d6, возвращает отсортированный массив (убывание) и top `level` значений. */
export function rollHitDice(numDice: number, level: number): { rolls: number[]; kept: number[]; total: number } {
  const rolls = Array.from({ length: numDice }, () => rollD6()).sort((a, b) => b - a)
  const kept = rolls.slice(0, level)
  const total = kept.reduce((a, b) => a + b, 0)
  return { rolls, kept, total }
}

export const STAT_ORDER: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export function sturdinessBonus(abilityIds: AbilityId[]): number {
  return abilityIds.includes('sturdy') ? 6 : 0
}
