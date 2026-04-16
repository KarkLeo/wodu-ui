export type MoveType = 'starting' | 'advanced_2_5' | 'advanced_6_10'

export interface Move {
  id: string
  classId: string
  name: string
  description: string
  type: MoveType
  requiresId?: string   // ход-условие (должен быть взят раньше)
  replacesId?: string   // этот ход заменяет указанный
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
