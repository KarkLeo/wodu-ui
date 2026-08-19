import type { CharacterCommand } from '@/domain/commands'
import type { StatKey } from '@/types/character'

export type ChangePayload =
  | { kind: 'hp-damage'; amount: number; tempBefore: number; tempAfter: number; hpBefore: number; hpAfter: number }
  | { kind: 'hp-heal'; amount: number; before: number; after: number }
  | { kind: 'hp-temp'; before: number; after: number }
  | { kind: 'armor-mod'; before: number; after: number }
  | { kind: 'damage-mod'; before: number; after: number }
  | { kind: 'xp-gain'; before: number; after: number }
  | { kind: 'level-up'; before: number; after: number }
  | { kind: 'stats'; changes: { key: StatKey; before: number; after: number }[] }
  | { kind: 'inventory-add'; itemName: string; itemTemplateId?: string; cost?: number; source: 'buy' | 'receive' | 'custom' }
  | { kind: 'inventory-remove'; itemName: string; itemTemplateId?: string }
  | { kind: 'inventory-use'; itemName: string; itemTemplateId?: string; quantityBefore: number; quantityAfter: number }
  | { kind: 'inventory-edit'; itemName: string; itemTemplateId?: string }
  | { kind: 'equip'; itemName: string; itemTemplateId?: string }
  | { kind: 'unequip'; itemName: string; itemTemplateId?: string }
  | { kind: 'coins'; before: number; after: number }
  | { kind: 'magic' }
  | { kind: 'modifier-add'; statKey: StatKey; label: string; amount: number }
  | { kind: 'modifier-remove'; statKey: StatKey; label: string; amount: number }
  | { kind: 'modifier-clear'; statKey?: StatKey; count: number }
  | { kind: 'quicksilver-reset'; before: number }
  | { kind: 'create'; characterName: string }

export type ChangeKind = ChangePayload['kind']

export interface ChangeEntry {
  id: string
  timestamp: number
  characterId: string
  characterName: string
  payload: ChangePayload
  sourceCommand: CharacterCommand['type']
}

export type ChangeDraft = Omit<ChangeEntry, 'id' | 'timestamp' | 'characterId' | 'characterName'>
