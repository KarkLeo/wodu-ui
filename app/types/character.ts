export const SKILL_IDS = [
  'athletics', 'awareness', 'deception', 'decipher', 'healing',
  'leadership', 'lore', 'stealth', 'survival',
] as const
export type SkillId = (typeof SKILL_IDS)[number]

export const ABILITY_IDS = [
  'blessing', 'heal', 'turnUndead', 'vision', 'sturdy', 'skirmish', 'hewing',
  'toughness', 'shadowStrike', 'luck', 'reflexes', 'skilled', 'incantations',
  'domination', 'ritual', 'summoning', 'pet', 'scouting', 'volley', 'savage',
] as const
export type AbilityId = (typeof ABILITY_IDS)[number]

export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>

export interface StatModifier {
  id: string
  statKey: StatKey
  amount: number
  label: string
}

export type ItemDescriptor =
  | { kind: 'weapon'; melee: true }
  | { kind: 'weapon'; melee: false }
  | { kind: 'armor'; class: 'none' | 'light' | 'full' }
  | { kind: 'shield' }
  | { kind: 'gear'; consumable?: boolean }
  | { kind: 'tool' }
  | { kind: 'occult'; consumable?: boolean }
  | { kind: 'custom'; consumable?: boolean }

export interface InventoryItem {
  id: string
  templateId?: string
  name: string
  descriptor: ItemDescriptor
  price?: number
  damage?: string
  notes?: string
  equipped?: boolean
  quantity?: number
}

export interface Spirit {
  id: string
  name: string
  appearance: string
  sphere1: string
  sphere2: string
}

export interface Ritual {
  name: string
  description: string
}

export interface Magic {
  spirits: Spirit[]
  rituals: Ritual[]
  cantrips: string[]
}

export type CharacterStatus = 'draft' | 'active'
export type ClassId = 'fighter' | 'thief' | 'cleric' | 'wizard' | 'ranger' | 'custom'

export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  name: string
  trueName?: string
  classId: ClassId
  customClassName?: string
  level: number
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number
  currentHp: number
  maxHp: number
  tempHp?: number
  armorMod?: number
  damageMod?: number
  hpHistory?: { level: number; roll: number; source: 'dice' | 'sturdy' }[]

  skillIds: SkillId[]
  abilityIds: AbilityId[]

  modifiers?: StatModifier[]

  inventory: InventoryItem[]
  coins: number

  magic?: Magic
  quicksilverCount?: number

  damageBonusDice: number
  notes: string
}

export interface ClassData {
  id: ClassId
  grantedSkillIds: SkillId[]
  abilityPool: AbilityId[]
  autoAbilityIds?: AbilityId[]
  hasMagic: boolean
}
