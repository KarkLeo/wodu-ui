import type { InventoryItem } from '@/types/character'

export const GEAR_CATEGORY_IDS = ['weapon', 'armor', 'gear', 'tool', 'occult', 'rare', 'fire'] as const
export type GearCategoryId = (typeof GEAR_CATEGORY_IDS)[number]

export type GearUseEffect = 'quicksilver'

export type GearTemplate = Omit<InventoryItem, 'id' | 'name' | 'notes'> & {
  templateId: string
  category: GearCategoryId
  useEffect?: GearUseEffect
}

export const GEAR_CATALOG = [
  // Weapons
  { templateId: 'light_weapon',  price: 10, descriptor: { kind: 'weapon', melee: true },  damage: '1d6',   category: 'weapon' },
  { templateId: 'battle_weapon', price: 30, descriptor: { kind: 'weapon', melee: true },  damage: '1d6+1', category: 'weapon' },
  { templateId: 'heavy_weapon',  price: 40, descriptor: { kind: 'weapon', melee: true },  damage: '1d6+2', category: 'weapon' },
  { templateId: 'short_bow',     price: 10, descriptor: { kind: 'weapon', melee: false }, damage: '1d6',   category: 'weapon' },
  { templateId: 'bow',           price: 30, descriptor: { kind: 'weapon', melee: false }, damage: '1d6+1', category: 'weapon' },
  { templateId: 'heavy_bow',     price: 50, descriptor: { kind: 'weapon', melee: false }, damage: '1d6+2', category: 'weapon' },
  // Armor
  { templateId: 'light_armor', price: 30, descriptor: { kind: 'armor', class: 'light' }, category: 'armor' },
  { templateId: 'full_armor',  price: 60, descriptor: { kind: 'armor', class: 'full' },  category: 'armor' },
  { templateId: 'shield',      price: 10, descriptor: { kind: 'shield' },                category: 'armor' },
  // Adventuring gear (2s)
  { templateId: 'rope',      price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'spike',     price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'chalk',     price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'parchment', price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'flint',     price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'torches',   price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'tent',      price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'dice',      price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'caltrops',  price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'bandages',  price: 2, descriptor: { kind: 'gear' },                  category: 'gear' },
  { templateId: 'rations',   price: 2, descriptor: { kind: 'gear', consumable: true }, category: 'gear' },
  { templateId: 'waterskin', price: 2, descriptor: { kind: 'gear', consumable: true }, category: 'gear' },
  { templateId: 'wineskin',  price: 2, descriptor: { kind: 'gear', consumable: true }, category: 'gear' },
  // Tools (5s)
  { templateId: 'crowbar',    price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'hatchet',    price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'snare',      price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'lockpicks',  price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'ink',        price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'fishingrod', price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'shovel',     price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'grapnel',    price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'pick',       price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  { templateId: 'pole',       price: 5, descriptor: { kind: 'tool' }, category: 'tool' },
  // Occult (10s)
  { templateId: 'mercury',   price: 10, descriptor: { kind: 'occult', consumable: true }, category: 'occult', useEffect: 'quicksilver' },
  { templateId: 'bonedust',  price: 10, descriptor: { kind: 'occult' },                   category: 'occult' },
  { templateId: 'holywater', price: 10, descriptor: { kind: 'occult', consumable: true }, category: 'occult' },
  { templateId: 'bloodvial', price: 10, descriptor: { kind: 'occult', consumable: true }, category: 'occult' },
  { templateId: 'incense',   price: 10, descriptor: { kind: 'occult' },                   category: 'occult' },
  // Rare (20s)
  { templateId: 'mirror',    price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'lantern',   price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'spyglass',  price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'hourglass', price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'boardgame', price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'finery',    price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  { templateId: 'symbols',   price: 20, descriptor: { kind: 'gear' }, category: 'rare' },
  // Fire oil
  { templateId: 'fireoil', price: 20, descriptor: { kind: 'gear', consumable: true }, category: 'fire' },
] as const satisfies readonly GearTemplate[]

export type GearTemplateId = (typeof GEAR_CATALOG)[number]['templateId']

export function findGearTemplate(templateId: string): GearTemplate | undefined {
  return GEAR_CATALOG.find(g => g.templateId === templateId)
}
