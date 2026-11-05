import type { LibraryMonster } from '@/types/library'
import type { RollRecord } from '@/types/dice'
import {
  CONDITIONS,
  type ConditionId,
  type EncounterHit,
  type EncounterMonster,
  type EncounterState,
  type SortMode,
  type TableSelection,
} from '@/types/encounter'

export function emptyEncounter(gameId: string): EncounterState {
  return { id: gameId, sortMode: 'auto', manualOrder: [], counters: {} }
}

export function monsterLabel(m: Pick<EncounterMonster, 'name' | 'n'>): string {
  return `${m.name} #${m.n}`
}

export function addInstance(
  state: EncounterState,
  entry: LibraryMonster,
  id: string,
  now: number,
): { state: EncounterState; monster: EncounterMonster } {
  const n = (state.counters[entry.id] ?? 0) + 1
  const monster: EncounterMonster = {
    id,
    sourceId: entry.id,
    n,
    name: entry.name,
    hp: entry.hp,
    maxHp: entry.hp,
    armor: entry.armor,
    damage: entry.damage,
    conditions: [],
    touchedAt: now,
  }
  if (entry.special !== undefined) monster.special = entry.special
  if (entry.notes !== undefined) monster.notes = entry.notes
  return {
    state: {
      ...state,
      manualOrder: [id, ...state.manualOrder],
      counters: { ...state.counters, [entry.id]: n },
    },
    monster,
  }
}

export function touch(m: EncounterMonster, now: number): EncounterMonster {
  return { ...m, touchedAt: now }
}

export function setHp(m: EncounterMonster, hp: number, now: number): EncounterMonster {
  const next = Math.min(m.maxHp, Math.max(0, hp))
  const out: EncounterMonster = { ...m, hp: next, touchedAt: now }
  if (next === 0) out.diedAt = m.diedAt ?? now
  else delete out.diedAt
  return out
}

export function changeHp(m: EncounterMonster, delta: number, now: number): EncounterMonster {
  return setHp(m, m.hp + delta, now)
}

export function killMonster(m: EncounterMonster, now: number): EncounterMonster {
  return setHp(m, 0, now)
}

export function reviveMonster(m: EncounterMonster, now: number): EncounterMonster {
  return setHp(m, 1, now)
}

export function toggleCondition(m: EncounterMonster, id: ConditionId, now: number): EncounterMonster {
  const conditions = m.conditions.includes(id) ? m.conditions.filter(c => c !== id) : [...m.conditions, id]
  return { ...m, conditions, touchedAt: now }
}

export function applyInstanceEdit(
  m: EncounterMonster,
  draft: Omit<LibraryMonster, 'id'>,
  now: number,
): EncounterMonster {
  const { special: _s, notes: _n, ...rest } = m
  const out: EncounterMonster = {
    ...rest,
    name: draft.name,
    maxHp: draft.hp,
    armor: draft.armor,
    damage: draft.damage,
  }
  if (draft.special !== undefined) out.special = draft.special
  if (draft.notes !== undefined) out.notes = draft.notes
  return setHp(out, m.hp, now)
}

export function orderMonsters(
  monsters: readonly EncounterMonster[],
  state: EncounterState,
): { alive: EncounterMonster[]; dead: EncounterMonster[] } {
  const alive = monsters.filter(m => m.diedAt === undefined)
  const dead = monsters.filter(m => m.diedAt !== undefined).sort((a, b) => b.diedAt! - a.diedAt!)
  const byTouched = (a: EncounterMonster, b: EncounterMonster) => b.touchedAt - a.touchedAt
  if (state.sortMode === 'auto') return { alive: alive.sort(byTouched), dead }
  const rank = new Map(state.manualOrder.map((id, i) => [id, i]))
  const unknown = alive.filter(m => !rank.has(m.id)).sort(byTouched)
  const known = alive.filter(m => rank.has(m.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  return { alive: [...unknown, ...known], dead }
}

export function switchSortMode(
  state: EncounterState,
  mode: SortMode,
  monsters: readonly EncounterMonster[],
): EncounterState {
  if (mode === 'auto') return { ...state, sortMode: 'auto' }
  const order = orderMonsters(monsters, { ...state, sortMode: 'auto' }).alive.map(m => m.id)
  return { ...state, sortMode: 'manual', manualOrder: order }
}

export function moveInOrder(order: readonly string[], id: string, beforeId: string | null): string[] {
  const rest = order.filter(x => x !== id)
  if (beforeId === null || beforeId === id) return beforeId === id ? [...order] : [...rest, id]
  const at = rest.indexOf(beforeId)
  if (at === -1) return [...rest, id]
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

export function damageAfterArmor(total: number, armor: number): number {
  return Math.max(0, total - armor)
}

export function previewHit(amount: number, hp: number, tempHp: number): { fromTemp: number; hpAfter: number } {
  const fromTemp = Math.min(amount, tempHp)
  return { fromTemp, hpAfter: Math.max(0, hp - (amount - fromTemp)) }
}

export function canApplyRoll(
  roll: RollRecord,
  selection: TableSelection,
  hits: readonly EncounterHit[],
  isDead: (id: string) => boolean,
): boolean {
  if (!selection || roll.purpose.kind !== 'damage') return false
  const byMonster = roll.monster !== undefined
  if (selection.kind === 'monster') {
    if (byMonster || isDead(selection.id)) return false
  } else if (!byMonster) {
    return false
  }
  return !hits.some(h => h.rollId === roll.id && h.target.id === selection.id)
}

export function isStaleMonster(incoming: EncounterMonster, local: EncounterMonster): boolean {
  return incoming.touchedAt < local.touchedAt
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isInt(v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function checkEncounterMonster(value: unknown): EncounterMonster | null {
  if (!isRecord(value)) return null
  const { id, sourceId, n, name, hp, maxHp, armor, damage, special, notes, conditions, touchedAt, diedAt } = value
  if (!isStr(id) || !isStr(sourceId) || !isStr(name) || !isStr(damage)) return null
  if (!isInt(n, 1) || !isInt(maxHp, 1) || !isInt(hp, 0, maxHp as number) || !isInt(armor, 0)) return null
  if (typeof touchedAt !== 'number' || !Number.isFinite(touchedAt)) return null
  if (special !== undefined && typeof special !== 'string') return null
  if (notes !== undefined && typeof notes !== 'string') return null
  if (diedAt !== undefined && (typeof diedAt !== 'number' || !Number.isFinite(diedAt))) return null
  if (!Array.isArray(conditions) || !conditions.every(c => (CONDITIONS as readonly unknown[]).includes(c))) return null
  const out: EncounterMonster = {
    id, sourceId, n, name, hp, maxHp, armor, damage, conditions: [...conditions] as ConditionId[], touchedAt,
  }
  if (special !== undefined) out.special = special
  if (notes !== undefined) out.notes = notes
  if (diedAt !== undefined) out.diedAt = diedAt
  return out
}

export function checkEncounterState(value: unknown): EncounterState | null {
  if (!isRecord(value)) return null
  const { id, sortMode, manualOrder, counters } = value
  if (!isStr(id) || (sortMode !== 'auto' && sortMode !== 'manual')) return null
  if (!Array.isArray(manualOrder) || !manualOrder.every(x => typeof x === 'string')) return null
  if (!isRecord(counters) || !Object.values(counters).every(c => isInt(c, 0))) return null
  return { id, sortMode, manualOrder: [...manualOrder], counters: { ...(counters as Record<string, number>) } }
}

export function checkEncounterHit(value: unknown): EncounterHit | null {
  if (!isRecord(value)) return null
  const { id, rollId, target, sourceName, rollTotal, armor, amount, at } = value
  if (!isStr(id) || !isStr(rollId) || typeof sourceName !== 'string') return null
  if (!isRecord(target) || (target.kind !== 'monster' && target.kind !== 'character')) return null
  if (!isStr(target.id) || typeof target.name !== 'string') return null
  if (!isInt(rollTotal, Number.MIN_SAFE_INTEGER) || !isInt(armor, 0) || !isInt(amount, 0)) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  return {
    id, rollId, target: { kind: target.kind, id: target.id, name: target.name }, sourceName, rollTotal, armor, amount, at,
  }
}
