import type { StatKey } from './character'

export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100

export interface DieResult {
  sides: DieSize
  value: number
}

export type RollPurpose =
  | { kind: 'stat'; statKey: StatKey; statBonus: number }
  | { kind: 'damage'; weaponName: string; formula: string }
  | { kind: 'free'; notation: string }
  | { kind: 'hp-init'; level: number; numDice: number; kept: number }
  | { kind: 'hit-dice'; fromLevel: number; toLevel: number; numDice: number; kept: number }

export interface RollRecord {
  id: string
  timestamp: number
  notation: string
  dice: DieResult[]
  diceTotal: number
  modifier: number
  total: number
  label: string
  purpose: RollPurpose
  characterId: string
}
