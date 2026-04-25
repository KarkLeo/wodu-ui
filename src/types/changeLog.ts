import type { CharacterCommand } from '@/domain/commands'

export type ChangeKind =
  | 'hp-damage'
  | 'hp-heal'
  | 'xp-gain'
  | 'level-up'
  | 'stats'
  | 'inventory-add'
  | 'inventory-remove'
  | 'inventory-use'
  | 'inventory-edit'
  | 'equip'
  | 'unequip'
  | 'coins'
  | 'magic'
  | 'modifier'
  | 'quicksilver-reset'
  | 'create'

export interface ChangeEntry {
  id: string
  timestamp: number
  characterId: string
  characterName: string
  kind: ChangeKind
  label: string
  delta?: string
  sourceCommand: CharacterCommand['type']
}

export type ChangeDraft = Omit<ChangeEntry, 'id' | 'timestamp' | 'characterId' | 'characterName'>
