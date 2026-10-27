import type { InventoryItem, ItemDescriptor } from '@/types/character'
import { LIBRARY_LIMITS, type LibraryItem, type LibraryMonster } from '@/types/library'
import { isConsumable } from '@/domain/inventory'

export type LibraryProblemKey =
  | 'notObject'
  | 'required'
  | 'tooLong'
  | 'notInteger'
  | 'outOfRange'
  | 'badFormula'
  | 'badDescriptor'

export interface LibraryProblem {
  field: string
  key: LibraryProblemKey
}

export type LibraryCheck<T> = { ok: true; value: T } | { ok: false; problems: LibraryProblem[] }

const DAMAGE_RE = /^(\d{0,2})d(4|6|8|10|12|20|100)([+-]\d{1,2})?$/

export function normalizeDamage(input: string): string | null {
  const m = DAMAGE_RE.exec(input.trim().replace(/\s+/g, '').toLowerCase())
  if (!m) return null
  const count = m[1] ? Number(m[1]) : 1
  if (count < 1) return null
  const mod = m[3] && Number(m[3]) !== 0 ? m[3] : ''
  return `${count}d${m[2]}${mod}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function checkId(raw: Record<string, unknown>, problems: LibraryProblem[]): string {
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) problems.push({ field: 'id', key: 'required' })
  return id
}

function checkName(raw: Record<string, unknown>, problems: LibraryProblem[]): string {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) problems.push({ field: 'name', key: 'required' })
  else if (name.length > LIBRARY_LIMITS.name) problems.push({ field: 'name', key: 'tooLong' })
  return name
}

function checkInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
  problems: LibraryProblem[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    problems.push({ field, key: 'notInteger' })
    return undefined
  }
  if (value < min || value > max) {
    problems.push({ field, key: 'outOfRange' })
    return undefined
  }
  return value
}

function optionalText(
  value: unknown,
  field: string,
  max: number,
  problems: LibraryProblem[],
): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    problems.push({ field, key: 'required' })
    return undefined
  }
  const text = value.trim()
  if (!text) return undefined
  if (text.length > max) {
    problems.push({ field, key: 'tooLong' })
    return undefined
  }
  return text
}

function checkDamage(value: unknown, problems: LibraryProblem[]): string | undefined {
  const norm = typeof value === 'string' ? normalizeDamage(value) : null
  if (norm === null) problems.push({ field: 'damage', key: 'badFormula' })
  return norm ?? undefined
}

export function checkMonster(value: unknown): LibraryCheck<LibraryMonster> {
  if (!isRecord(value)) return { ok: false, problems: [{ field: '*', key: 'notObject' }] }
  const problems: LibraryProblem[] = []
  const id = checkId(value, problems)
  const name = checkName(value, problems)
  const hp = checkInt(value.hp, 'hp', 1, LIBRARY_LIMITS.hpMax, problems)
  const armor = checkInt(value.armor, 'armor', 0, LIBRARY_LIMITS.armorMax, problems)
  const damage = checkDamage(value.damage, problems)
  const special = optionalText(value.special, 'special', LIBRARY_LIMITS.special, problems)
  const notes = optionalText(value.notes, 'notes', LIBRARY_LIMITS.notes, problems)
  if (problems.length || hp === undefined || armor === undefined || damage === undefined) {
    return { ok: false, problems }
  }
  const out: LibraryMonster = { id, name, hp, armor, damage }
  if (special) out.special = special
  if (notes) out.notes = notes
  return { ok: true, value: out }
}

function checkDescriptor(raw: unknown): ItemDescriptor | null {
  if (!isRecord(raw)) return null
  const consumable = raw.consumable
  if (consumable !== undefined && typeof consumable !== 'boolean') return null
  switch (raw.kind) {
    case 'weapon':
      return typeof raw.melee === 'boolean' ? { kind: 'weapon', melee: raw.melee } : null
    case 'armor':
      return raw.class === 'none' || raw.class === 'light' || raw.class === 'full'
        ? { kind: 'armor', class: raw.class }
        : null
    case 'shield':
      return { kind: 'shield' }
    case 'tool':
      return { kind: 'tool' }
    case 'gear':
    case 'occult':
    case 'custom':
      return consumable === undefined ? { kind: raw.kind } : { kind: raw.kind, consumable }
    default:
      return null
  }
}

export function checkItem(value: unknown): LibraryCheck<LibraryItem> {
  if (!isRecord(value)) return { ok: false, problems: [{ field: '*', key: 'notObject' }] }
  const problems: LibraryProblem[] = []
  const id = checkId(value, problems)
  const name = checkName(value, problems)
  const descriptor = checkDescriptor(value.descriptor)
  if (!descriptor) problems.push({ field: 'descriptor', key: 'badDescriptor' })

  let damage: string | undefined
  if (value.damage !== undefined && value.damage !== null && value.damage !== '') {
    damage = checkDamage(value.damage, problems)
  }
  let price: number | undefined
  if (value.price !== undefined && value.price !== null) {
    price = checkInt(value.price, 'price', 0, LIBRARY_LIMITS.priceMax, problems)
  }
  const notes = optionalText(value.notes, 'notes', LIBRARY_LIMITS.notes, problems)

  let quantity: number | undefined
  if (descriptor && isConsumable({ descriptor }) && value.quantity !== undefined && value.quantity !== null) {
    quantity = checkInt(value.quantity, 'quantity', 1, LIBRARY_LIMITS.quantityMax, problems)
  }

  if (problems.length || !descriptor) return { ok: false, problems }
  const out: LibraryItem = { id, name, descriptor }
  if (damage) out.damage = damage
  if (price !== undefined) out.price = price
  if (notes) out.notes = notes
  if (quantity !== undefined) out.quantity = quantity
  return { ok: true, value: out }
}

export function libraryItemToInventory(item: LibraryItem): Omit<InventoryItem, 'id'> {
  const out: Omit<InventoryItem, 'id'> = {
    name: item.name,
    descriptor: item.descriptor,
    libraryItemId: item.id,
  }
  if (item.damage !== undefined) out.damage = item.damage
  if (item.price !== undefined) out.price = item.price
  if (item.notes !== undefined) out.notes = item.notes
  if (isConsumable(item)) out.quantity = item.quantity ?? 1
  return out
}
