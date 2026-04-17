export const SKILLS = [
  { id: 'athletics',  name: 'Атлетика' },
  { id: 'awareness',  name: 'Внимательность' },
  { id: 'deception',  name: 'Обман' },
  { id: 'decipher',   name: 'Расшифровка' },
  { id: 'healing',    name: 'Лечение' },
  { id: 'leadership', name: 'Лидерство' },
  { id: 'lore',       name: 'Знания' },
  { id: 'stealth',    name: 'Скрытность' },
  { id: 'survival',   name: 'Выживание' },
] as const
export type SkillId = typeof SKILLS[number]['id']

export const ABILITIES = [
  { id: 'blessing',     name: 'Благословение', description: 'Освящаешь предметы святой водой — они считаются святыми и магическими, +3 к урону против нечисти (на короткое время).' },
  { id: 'heal',         name: 'Исцеление',     description: 'Можешь нейтрализовать яды, снять проклятия или исцелить раны касанием.' },
  { id: 'turnUndead',   name: 'Отвращение нежити', description: 'Сдерживаешь нежить силой веры и святым символом.' },
  { id: 'vision',       name: 'Видение',       description: 'Выпей святую воду, чтобы услышать наставления своего божества.' },
  { id: 'sturdy',       name: 'Стойкость',     description: '+6 ОЗ.' },
  { id: 'skirmish',     name: 'Манёвренность', description: '+1 к урону, надетый доспех считается на класс легче.' },
  { id: 'hewing',       name: 'Рубка',         description: '+2 к урону в ближнем бою.' },
  { id: 'toughness',    name: 'Прочность',     description: '+1 к броне.' },
  { id: 'shadowStrike', name: 'Удар из тени',  description: 'Атака из укрытия даёт +3 к урону.' },
  { id: 'luck',         name: 'Удача',         description: 'Раз в день можешь превратить промах в частичный успех.' },
  { id: 'reflexes',     name: 'Реакция',       description: 'Ты всегда действуешь первым и можешь реагировать при внезапном нападении.' },
  { id: 'skilled',      name: 'Умелец',        description: 'Можешь быстро вскрыть замок, срезать кошелёк или обезвредить ловушку.' },
  { id: 'incantations', name: 'Заклички',      description: 'Знаешь три простых заклинания: Свеча, Тень, Чревовещание.' },
  { id: 'domination',   name: 'Подчинение',    description: 'Можешь попытаться подчинить любого духа, демона и т.д.' },
  { id: 'ritual',       name: 'Ритуал',        description: 'Можешь проводить оккультные ритуалы (из фолиантов и свитков); начинаешь с двумя известными ритуалами.' },
  { id: 'summoning',    name: 'Призыв',        description: 'Можешь призывать известных тебе духов (см. правила магии).' },
  { id: 'pet',          name: 'Питомец',       description: 'У тебя есть верный и умелый животный компаньон.' },
  { id: 'scouting',     name: 'Разведка',      description: 'Когда ведёшь разведку — всегда замечаешь цель прежде, чем она заметит тебя.' },
  { id: 'volley',       name: 'Залп',          description: '+2 к урону дальнего боя.' },
  { id: 'savage',       name: 'Дикарь',        description: 'Можешь разговаривать с животными и пытаться ими командовать.' },
] as const
export type AbilityId = typeof ABILITIES[number]['id']

export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>

export type ArmorType = 'none' | 'light' | 'full'
export interface ArmorState { type: ArmorType; shield: boolean }

export interface InventoryItem {
  id: string
  name: string
  price?: number
  tags: string[]
  damage?: string
  notes?: string
}

export interface Spirit {
  id: string
  name: string
  appearance: string
  sphere1: string
  sphere2: string
}

export interface Magic {
  spirits: Spirit[]
  rituals: string[]
  cantrips: string[]
}

export type CharacterStatus = 'draft' | 'active'
export type ClassId = 'fighter' | 'thief' | 'cleric' | 'wizard' | 'ranger'

export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  name: string
  trueName?: string
  classId: ClassId
  level: number
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number
  currentHp: number
  maxHp: number

  skillIds: SkillId[]
  abilityIds: AbilityId[]

  armor: ArmorState
  inventory: InventoryItem[]
  coins: number

  magic?: Magic

  damageBonusDice: number
  notes: string
}

export interface ClassData {
  id: ClassId
  name: string
  grantedSkillIds: SkillId[]
  abilityPool: AbilityId[]
  autoAbilityIds?: AbilityId[]
  hasMagic: boolean
}
