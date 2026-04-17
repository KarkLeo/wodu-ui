export type MoveType = 'starting' | 'advanced_2_5' | 'advanced_6_10'

export interface Move {
  id: string
  classId: string
  name: string
  trigger?: string      // «когда ты…» + бросок
  hit10?: string        // результат на 10+
  hit7?: string         // результат на 7–9
  miss?: string         // результат на провале
  options?: string[]    // список для ходов «выберите N из этих вариантов»
  note?: string         // дополнительный абзац после тиров (отдельное правило хода)
  description?: string  // пассивный текст или fallback (если нет trigger)
  type: MoveType
  requiresId?: string
  replacesId?: string
}

export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface Debilities {
  weak: boolean      // СИЛ -1
  shaky: boolean     // ЛОВ -1
  sick: boolean      // КОН -1
  stunned: boolean   // ИНТ -1
  confused: boolean  // МДР -1
  scarred: boolean   // ХАР -1
}

export interface InventoryItem {
  id: string
  name: string
  weight: number
  tags: string[]
  uses?: number
}

export interface SignatureWeapon {
  base: string
  range: string
  enhancements: string[]
  appearance: string
}

export type CharacterStatus = 'draft' | 'active'

export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  // Создание (заполняются в мастере, не редактируются в игре)
  classId: string
  name: string
  look: string
  alignment: string
  race: string
  bonds: string[]           // шаблоны заполняются в игре
  startingMoveIds: string[]
  signatureWeapon?: SignatureWeapon

  // Игровые данные
  stats: Stats
  currentHp: number
  maxHp: number
  armor: number
  xp: number
  level: number
  damageDice: string        // 'd10' для Fighter
  debilities: Debilities
  moveIds: string[]         // все взятые ходы (включая стартовые)
  inventory: InventoryItem[]
  coins: number
  maxLoad: number           // load вычисляется на лету: sum(inventory[].weight)
}

// Данные класса (статика)
export interface ClassData {
  id: string
  name: string
  damageDice: string
  baseHp: number
  baseLoad: number
  moves: Move[]
  startingGear: InventoryItem[][]   // группы вариантов на выбор
  alignments: Array<{ id: string; name: string; trigger: string }>
  races: Array<{ id: string; name: string; moveId: string }>
  looks: Array<{ category: string; options: string[] }>
  bondTemplates: string[]
}
