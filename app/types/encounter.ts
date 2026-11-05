export const CONDITIONS = ['stunned', 'grappled', 'prone', 'blinded', 'burning', 'poisoned', 'frightened', 'controlled', 'unaware'] as const
export type ConditionId = (typeof CONDITIONS)[number]
export type SortMode = 'auto' | 'manual'

export interface EncounterMonster {
  id: string
  sourceId: string
  n: number
  name: string
  hp: number
  maxHp: number
  armor: number
  damage: string
  special?: string
  notes?: string
  conditions: ConditionId[]
  touchedAt: number
  diedAt?: number
}

export interface EncounterState {
  id: string
  sortMode: SortMode
  manualOrder: string[]
  counters: Record<string, number>
}

export interface HitTarget {
  kind: 'monster' | 'character'
  id: string
  name: string
}

export interface EncounterHit {
  id: string
  rollId: string
  target: HitTarget
  sourceName: string
  rollTotal: number
  armor: number
  amount: number
  at: number
}

export type TableSelection = { kind: 'monster'; id: string } | { kind: 'character'; id: string } | null
