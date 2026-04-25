import type { AbilityId, Character, InventoryItem, StatKey } from '@/types/character'
import { ABILITIES } from '@/types/character'
import { XP_THRESHOLDS } from '@/data/xpTable'
import { getAbilityEffect } from '@/data/abilities'

export interface BreakdownLine {
  value: string
  label: string
}

interface EquippedArmorState {
  hasFull: boolean
  hasLight: boolean
  hasShield: boolean
}

function getEquippedArmor(char: Pick<Character, 'inventory'>): EquippedArmorState {
  const equipped = (char.inventory ?? []).filter(i => i.equipped)
  return {
    hasFull: equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'full'),
    hasLight: equipped.some(i => i.descriptor.kind === 'armor' && i.descriptor.class === 'light'),
    hasShield: equipped.some(i => i.descriptor.kind === 'shield'),
  }
}

function abilityName(id: AbilityId): string {
  return ABILITIES.find(a => a.id === id)?.name ?? id
}

const ABILITY_SHORT_NAME: Partial<Record<AbilityId, string>> = {
  skirmish: 'Манёвр.',
  hewing: 'Рубка',
  volley: 'Залп',
}

function abilityShortName(id: AbilityId): string {
  return ABILITY_SHORT_NAME[id] ?? abilityName(id)
}

function weaponScope(weapon: InventoryItem): 'melee' | 'ranged' | null {
  if (weapon.descriptor.kind !== 'weapon') return null
  if (weapon.descriptor.melee === true) return 'melee'
  if (weapon.descriptor.melee === false) return 'ranged'
  return null
}

function damageBonusesForWeapon(
  abilityIds: readonly AbilityId[],
  weapon: InventoryItem,
): { id: AbilityId; amount: number }[] {
  const scope = weaponScope(weapon)
  const out: { id: AbilityId; amount: number }[] = []
  for (const id of abilityIds) {
    const bonus = getAbilityEffect(id)?.damageBonus
    if (!bonus) continue
    if (bonus.scope !== 'all' && bonus.scope !== scope) continue
    out.push({ id, amount: bonus.amount })
  }
  return out
}

export function totalArmor(char: Pick<Character, 'inventory' | 'abilityIds' | 'armorMod'>): number {
  const { hasFull, hasLight, hasShield } = getEquippedArmor(char)
  const base = hasFull ? 2 : hasLight ? 1 : 0
  const shield = hasShield ? 1 : 0
  let abilityBonus = 0
  for (const id of char.abilityIds ?? []) {
    abilityBonus += getAbilityEffect(id)?.armorBonus ?? 0
  }
  const mod = char.armorMod ?? 0
  return Math.max(0, base + shield + abilityBonus + mod)
}

export function isWeapon(item: InventoryItem): boolean {
  return item.descriptor.kind === 'weapon'
}

export function damageFormula(char: Pick<Character, 'abilityIds' | 'damageBonusDice'>, weapon: InventoryItem): string {
  if (!weapon.damage) return '—'
  const bonuses = damageBonusesForWeapon(char.abilityIds ?? [], weapon)
  const bonusDice = char.damageBonusDice > 0 ? ` +${char.damageBonusDice}d6` : ''
  const extras = bonuses.length
    ? ' (' + bonuses.map(b => `+${b.amount} ${abilityShortName(b.id)}`).join(', ') + ')'
    : ''
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

export function statModifierTotal(char: Pick<Character, 'modifiers'>, key: StatKey): number {
  const list = char.modifiers ?? []
  let sum = 0
  for (const m of list) if (m.statKey === key) sum += m.amount
  return sum
}

export function effectiveStat(char: Pick<Character, 'stats' | 'modifiers'>, key: StatKey): number {
  return char.stats[key] + statModifierTotal(char, key)
}

export function statModifierLines(
  char: Pick<Character, 'modifiers'>,
  key: StatKey,
): { id: string; amount: number; label: string }[] {
  return (char.modifiers ?? [])
    .filter(m => m.statKey === key)
    .map(m => ({ id: m.id, amount: m.amount, label: m.label }))
}

export function parseDamageNotation(formula: string): string {
  const head = formula.split(/[\s(]/)[0]
  return head.replace(/^d/i, '1d')
}

export function sturdinessBonus(abilityIds: AbilityId[]): number {
  return abilityIds.includes('sturdy') ? 6 : 0
}

export function hpBreakdownLines(hpHistory: Character['hpHistory']): BreakdownLine[] {
  if (!hpHistory?.length) return []
  return hpHistory.map(entry => ({
    value: entry.source === 'sturdy' ? '+6' : String(entry.roll),
    label: entry.source === 'sturdy' ? abilityName('sturdy') : `ур. ${entry.level}, бросок к6`,
  }))
}

export function damageAbilityBonus(
  char: Pick<Character, 'abilityIds'>,
  weapon: InventoryItem,
): number {
  return damageBonusesForWeapon(char.abilityIds ?? [], weapon).reduce((sum, b) => sum + b.amount, 0)
}

export function damageFormulaCompact(
  char: Pick<Character, 'abilityIds' | 'damageBonusDice' | 'damageMod'>,
  weapon: InventoryItem,
): string {
  if (!weapon.damage) return '—'
  const m = weapon.damage.trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!m) return weapon.damage
  const count = m[1] ? Number(m[1]) : 1
  const side = Number(m[2])
  const baseFlat = m[3] ? (m[3] === '-' ? -Number(m[4]) : Number(m[4])) : 0
  const flatSum = baseFlat + damageAbilityBonus(char, weapon) + (char.damageMod ?? 0)
  const bonusDice = char.damageBonusDice > 0 ? char.damageBonusDice : 0
  const sameSide = side === 6
  const totalCount = sameSide ? count + bonusDice : count
  const bonusDiceStr = !sameSide && bonusDice > 0 ? `+${bonusDice}d6` : ''
  const flatStr = flatSum > 0 ? `+${flatSum}` : flatSum < 0 ? String(flatSum) : ''
  return `${totalCount}d${side}${flatStr}${bonusDiceStr}`
}

export interface DamageFormulaParts {
  base: string
  tail: string
  tailTone: 'buff' | 'debuff' | 'neutral'
}

export function damageFormulaParts(
  char: Pick<Character, 'abilityIds' | 'damageBonusDice' | 'damageMod'>,
  weapon: InventoryItem,
): DamageFormulaParts | null {
  if (!weapon.damage) return null
  const m = weapon.damage.trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!m) return { base: weapon.damage, tail: '', tailTone: 'neutral' }
  const count = m[1] ? Number(m[1]) : 1
  const side = Number(m[2])
  const baseFlat = m[3] ? (m[3] === '-' ? -Number(m[4]) : Number(m[4])) : 0
  const mod = char.damageMod ?? 0
  const flatSum = baseFlat + damageAbilityBonus(char, weapon) + mod
  const bonusDice = char.damageBonusDice > 0 ? char.damageBonusDice : 0
  const sameSide = side === 6
  const totalCount = sameSide ? count + bonusDice : count
  const bonusDiceStr = !sameSide && bonusDice > 0 ? `+${bonusDice}d6` : ''
  const base = `${totalCount}d${side}${bonusDiceStr}`
  const tail = flatSum > 0 ? `+${flatSum}` : flatSum < 0 ? String(flatSum) : ''
  const tailTone: DamageFormulaParts['tailTone'] = mod > 0 ? 'buff' : mod < 0 ? 'debuff' : 'neutral'
  return { base, tail, tailTone }
}

export function damageBreakdownLines(
  char: Pick<Character, 'abilityIds' | 'damageBonusDice' | 'damageMod'>,
  weapon: InventoryItem,
): BreakdownLine[] {
  if (!weapon.damage) return []
  const lines: BreakdownLine[] = [{ value: weapon.damage, label: 'Оружие' }]
  for (const b of damageBonusesForWeapon(char.abilityIds ?? [], weapon)) {
    lines.push({ value: `+${b.amount}`, label: abilityName(b.id) })
  }
  if (char.damageBonusDice > 0) lines.push({ value: `+${char.damageBonusDice}d6`, label: 'Бонус уровня' })
  const mod = char.damageMod ?? 0
  if (mod !== 0) lines.push({ value: mod > 0 ? `+${mod}` : String(mod), label: 'Эффекты' })
  return lines
}

export function armorBreakdownLines(char: Pick<Character, 'inventory' | 'abilityIds' | 'armorMod'>): {
  lines: BreakdownLine[]
  note?: string
} {
  const { hasFull, hasLight, hasShield } = getEquippedArmor(char)
  const lines: BreakdownLine[] = []
  if (hasFull) lines.push({ value: '2', label: 'полный доспех' })
  else if (hasLight) lines.push({ value: '1', label: 'лёгкий доспех' })
  if (hasShield) lines.push({ value: '+1', label: 'щит' })
  const abilityIds = char.abilityIds ?? []
  for (const id of abilityIds) {
    const bonus = getAbilityEffect(id)?.armorBonus
    if (bonus) lines.push({ value: `+${bonus}`, label: abilityName(id) })
  }
  const mod = char.armorMod ?? 0
  if (mod !== 0) lines.push({ value: mod > 0 ? `+${mod}` : String(mod), label: 'Эффекты' })
  const lighterAbilityId = abilityIds.find(id => getAbilityEffect(id)?.armorTreatedAsLighter)
  const note = lighterAbilityId
    ? `доспех считается лёгким (${abilityName(lighterAbilityId)})`
    : undefined
  return { lines, note }
}
