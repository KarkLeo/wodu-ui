import { DiceRoll } from '@dice-roller/rpg-dice-roller'
import type { DieResult, DieSize, RollMode } from '@/types/dice'

const ALLOWED_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20, 100])
const DICE_TERM = /(\d*)d(\d+)/gi

interface DiceGroupMeta {
  count: number
  sides: DieSize
}

function parseDiceGroups(notation: string): DiceGroupMeta[] {
  const groups: DiceGroupMeta[] = []
  for (const match of notation.matchAll(DICE_TERM)) {
    const count = match[1] ? Number(match[1]) : 1
    const sides = Number(match[2])
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error(`DiceEngine: invalid dice count in "${notation}"`)
    }
    if (!ALLOWED_SIDES.has(sides)) {
      throw new Error(`DiceEngine: unsupported die size d${sides} in "${notation}"`)
    }
    groups.push({ count, sides: sides as DieSize })
  }
  if (groups.length === 0) {
    throw new Error(`DiceEngine: no dice terms in "${notation}"`)
  }
  return groups
}

function isRollResults(value: unknown): value is { rolls: Array<{ value: number }> } {
  return typeof value === 'object'
    && value !== null
    && 'rolls' in value
    && Array.isArray((value as { rolls: unknown }).rolls)
}

export interface DiceRollOutcome {
  dice: DieResult[]
  total: number
  discardedDice?: DieResult[]
  discardedTotal?: number
}

function rollOnce(notation: string): { dice: DieResult[]; total: number } {
  const groups = parseDiceGroups(notation)
  const roll = new DiceRoll(notation)

  const groupResults: Array<{ value: number }[]> = []
  for (const item of roll.rolls) {
    if (isRollResults(item)) groupResults.push(item.rolls)
  }

  if (groupResults.length !== groups.length) {
    throw new Error(
      `DiceEngine: parsed ${groups.length} dice groups but rpg-dice-roller produced ${groupResults.length}`,
    )
  }

  const dice: DieResult[] = []
  for (let i = 0; i < groups.length; i++) {
    const meta = groups[i]
    const results = groupResults[i]
    if (results.length !== meta.count) {
      throw new Error(
        `DiceEngine: expected ${meta.count} rolls for d${meta.sides}, got ${results.length}`,
      )
    }
    for (const r of results) dice.push({ sides: meta.sides, value: r.value })
  }

  const total = dice.reduce((s, d) => s + d.value, 0)
  return { dice, total }
}

export function rollNotation(notation: string, mode: RollMode = 'normal'): DiceRollOutcome {
  if (mode === 'normal') return rollOnce(notation)

  const a = rollOnce(notation)
  const b = rollOnce(notation)
  const keepFirst = mode === 'advantage' ? a.total >= b.total : a.total <= b.total
  const kept = keepFirst ? a : b
  const discarded = keepFirst ? b : a
  return {
    dice: kept.dice,
    total: kept.total,
    discardedDice: discarded.dice,
    discardedTotal: discarded.total,
  }
}
