import type { AbilityId, Character, InventoryItem, StatKey } from '@/types/character'
import { XP_THRESHOLDS } from '@/data/xpTable'

export interface BreakdownLine {
  value: string
  label: string
}

export function totalArmor(char: Pick<Character, 'inventory' | 'abilityIds'>): number {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  const hasFull = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'full')
  const hasLight = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'light')
  const hasShield = equipped.some(i => i.descriptor.kind === 'shield')
  const base = hasFull ? 2 : hasLight ? 1 : 0
  const shield = hasShield ? 1 : 0
  const toughness = (char.abilityIds ?? []).includes('toughness') ? 1 : 0
  return base + shield + toughness
}

export function armorTypeLabel(char: Pick<Character, 'inventory'>): string {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  const hasFull = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'full')
  const hasLight = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'light')
  const hasShield = equipped.some(i => i.descriptor.kind === 'shield')
  const base = hasFull ? 'полный' : hasLight ? 'лёгкий' : ''
  if (!base && !hasShield) return ''
  if (!base) return 'щит'
  return hasShield ? `${base} + щит` : base
}

export function isWeapon(item: InventoryItem): boolean {
  return item.descriptor.kind === 'weapon'
}

export function damageFormula(char: Pick<Character, 'abilityIds' | 'damageBonusDice'>, weapon: InventoryItem): string {
  if (!weapon.damage) return '—'
  const bonuses: string[] = []
  const melee = weapon.descriptor.kind === 'weapon' && weapon.descriptor.melee === true
  const ranged = weapon.descriptor.kind === 'weapon' && weapon.descriptor.melee === false
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

export function isQuicksilverOverdose(char: Pick<Character, 'quicksilverCount' | 'level'>): boolean {
  return (char.quicksilverCount ?? 0) >= char.level
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

export function hpBreakdownLines(hpHistory: Character['hpHistory']): BreakdownLine[] {
  if (!hpHistory?.length) return []
  return hpHistory.map(entry => ({
    value: entry.source === 'sturdy' ? '+6' : String(entry.roll),
    label: entry.source === 'sturdy' ? 'Стойкость' : `ур. ${entry.level}, бросок к6`,
  }))
}

export function damageBreakdownLines(
  char: Pick<Character, 'abilityIds' | 'damageBonusDice'>,
  weapon: InventoryItem,
): BreakdownLine[] {
  if (!weapon.damage) return []
  const lines: BreakdownLine[] = [{ value: weapon.damage, label: 'оружие' }]
  const melee = weapon.descriptor.kind === 'weapon' && weapon.descriptor.melee === true
  const ranged = weapon.descriptor.kind === 'weapon' && weapon.descriptor.melee === false
  const abilityIds = char.abilityIds ?? []
  if (abilityIds.includes('skirmish')) lines.push({ value: '+1', label: 'Манёвренность' })
  if (melee && abilityIds.includes('hewing')) lines.push({ value: '+2', label: 'Рубка' })
  if (ranged && abilityIds.includes('volley')) lines.push({ value: '+2', label: 'Залп' })
  if (char.damageBonusDice > 0) lines.push({ value: `+${char.damageBonusDice}d6`, label: 'бонус уровня' })
  return lines
}

export function armorBreakdownLines(char: Pick<Character, 'inventory' | 'abilityIds'>): {
  lines: BreakdownLine[]
  note?: string
} {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  const hasFull = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'full')
  const hasLight = equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'light')
  const hasShield = equipped.some(i => i.descriptor.kind === 'shield')
  const lines: BreakdownLine[] = []
  if (hasFull) lines.push({ value: '2', label: 'полный доспех' })
  else if (hasLight) lines.push({ value: '1', label: 'лёгкий доспех' })
  if (hasShield) lines.push({ value: '+1', label: 'щит' })
  const abilityIds = char.abilityIds ?? []
  if (abilityIds.includes('toughness')) lines.push({ value: '+1', label: 'Прочность' })
  const note = abilityIds.includes('skirmish') ? 'доспех считается лёгким (Манёвренность)' : undefined
  return { lines, note }
}
