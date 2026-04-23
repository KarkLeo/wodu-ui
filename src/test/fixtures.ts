import type {
  Character,
  InventoryItem,
  ItemDescriptor,
  Stats,
} from '@/types/character'

const ZERO_STATS: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }

export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    createdAt: 0,
    status: 'active',
    name: 'Тестовый',
    classId: 'fighter',
    level: 1,
    xp: 0,
    stats: { ...ZERO_STATS },
    statRolls: { str: 7, dex: 7, con: 7, int: 7, wis: 7, cha: 7 },
    hitDice: 1,
    currentHp: 6,
    maxHp: 6,
    skillIds: [],
    abilityIds: [],
    inventory: [],
    coins: 100,
    damageBonusDice: 0,
    notes: '',
    ...overrides,
  }
}

let itemCounter = 0
function nextItemId(): string {
  itemCounter += 1
  return `item-${itemCounter}`
}

export function resetItemCounter(): void {
  itemCounter = 0
}

function makeItem(
  descriptor: ItemDescriptor,
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return {
    id: nextItemId(),
    name: 'item',
    descriptor,
    ...overrides,
  }
}

export function makeWeapon(
  overrides: Partial<InventoryItem> & { melee?: boolean } = {},
): InventoryItem {
  const { melee = true, ...rest } = overrides
  return makeItem(
    { kind: 'weapon', melee } as ItemDescriptor,
    { name: melee ? 'Меч' : 'Лук', damage: 'd6', ...rest },
  )
}

export function makeArmor(
  klass: 'light' | 'full',
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return makeItem(
    { kind: 'armor', class: klass },
    { name: klass === 'full' ? 'Полный доспех' : 'Лёгкий доспех', equipped: true, ...overrides },
  )
}

export function makeShield(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return makeItem({ kind: 'shield' }, { name: 'Щит', equipped: true, ...overrides })
}

export function makeGear(
  consumable = false,
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return makeItem(
    { kind: 'gear', consumable } as ItemDescriptor,
    { name: 'Снаряжение', ...overrides },
  )
}

export function makeCustom(
  consumable = false,
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return makeItem(
    { kind: 'custom', consumable } as ItemDescriptor,
    { name: 'Свой предмет', ...overrides },
  )
}
