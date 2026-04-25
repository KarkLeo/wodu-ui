import { describe, it, expect, beforeEach } from 'vitest'
import { applyCommand } from './reducer'
import type { LevelUpPatch } from './commands'
import type { InventoryItem, Magic } from '@/types/character'
import {
  makeCharacter,
  makeWeapon,
  makeArmor,
  makeCustom,
  resetItemCounter,
} from '@/test/fixtures'

beforeEach(() => {
  resetItemCounter()
})

describe('applyCommand: BUY_ITEM', () => {
  it('покупка существующего шаблона списывает монеты и добавляет предмет', () => {
    const char = makeCharacter({ coins: 50 })
    const { character, changes } = applyCommand(char, {
      type: 'BUY_ITEM',
      templateId: 'light_weapon',
    })
    expect(character.coins).toBe(40)
    expect(character.inventory).toHaveLength(1)
    expect(character.inventory[0].name).toBe('Лёгкое оружие')
    expect(changes).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'buy', cost: 10 })
  })
  it('неизвестный шаблон не меняет персонажа и не пишет changes', () => {
    const char = makeCharacter({ coins: 50 })
    const { character, changes } = applyCommand(char, {
      type: 'BUY_ITEM',
      templateId: 'no_such_template',
    })
    expect(character).toBe(char)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: RECEIVE_ITEM', () => {
  it('добавляет предмет и пишет change', () => {
    const char = makeCharacter()
    const { character, changes } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: { name: 'Подарок', descriptor: { kind: 'gear' } },
    })
    expect(character.inventory).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'receive', itemName: 'Подарок' })
  })
})

describe('applyCommand: ADD_CUSTOM_ITEM', () => {
  it('списывает цену и пишет change', () => {
    const char = makeCharacter({ coins: 20 })
    const { character, changes } = applyCommand(char, {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Артефакт',
      price: 5,
    })
    expect(character.coins).toBe(15)
    expect(character.inventory).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'custom', cost: 5 })
  })
  it('без цены — payload без cost', () => {
    const { changes } = applyCommand(makeCharacter(), {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Подарок',
    })
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'custom', itemName: 'Подарок' })
    expect((changes[0].payload as { cost?: number }).cost).toBeUndefined()
  })
  it('цена больше монет — coins clamp\'ятся к 0', () => {
    const char = makeCharacter({ coins: 5 })
    const { character } = applyCommand(char, {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Дорогой',
      price: 20,
    })
    expect(character.coins).toBe(0)
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM', () => {
  it('правит имя custom-предмета', () => {
    const item = makeCustom(false, { name: 'старое' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'новое',
    })
    expect(character.inventory[0].name).toBe('новое')
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-edit', itemName: 'новое' })
  })
})

describe('applyCommand: REMOVE_ITEM', () => {
  it('удаляет и пишет change', () => {
    const item = makeWeapon()
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'REMOVE_ITEM', itemId: item.id })
    expect(character.inventory).toEqual([])
    expect(changes[0].payload.kind).toBe('inventory-remove')
  })
})

describe('applyCommand: USE_ITEM', () => {
  it('quantity > 1 — уменьшает на 1, лейбл показывает x→x', () => {
    const item = makeCustom(true, { quantity: 3, name: 'Зелье' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'USE_ITEM', itemId: item.id })
    expect(character.inventory[0].quantity).toBe(2)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-use', itemName: 'Зелье', quantityBefore: 3, quantityAfter: 2 })
  })
  it('quantity === 1 — удаляет предмет', () => {
    const item = makeCustom(true, { quantity: 1, name: 'Зелье' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'USE_ITEM', itemId: item.id })
    expect(character.inventory).toEqual([])
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-use', itemName: 'Зелье', quantityBefore: 1 })
  })
  it('mercury — инкрементирует quicksilverCount (undefined → 1)', () => {
    const mercury: InventoryItem = {
      id: 'mercury-1',
      templateId: 'mercury',
      name: 'Ртуть (доза)',
      descriptor: { kind: 'occult', consumable: true },
      quantity: 2,
    }
    const char = makeCharacter({ inventory: [mercury] })
    expect(char.quicksilverCount).toBeUndefined()
    const { character } = applyCommand(char, { type: 'USE_ITEM', itemId: mercury.id })
    expect(character.quicksilverCount).toBe(1)
    expect(character.inventory[0].quantity).toBe(1)
  })
  it('mercury — накопительный инкремент с существующего count', () => {
    const mercury: InventoryItem = {
      id: 'mercury-2',
      templateId: 'mercury',
      name: 'Ртуть (доза)',
      descriptor: { kind: 'occult', consumable: true },
      quantity: 1,
    }
    const char = makeCharacter({ inventory: [mercury], quicksilverCount: 2 })
    const { character } = applyCommand(char, { type: 'USE_ITEM', itemId: mercury.id })
    expect(character.quicksilverCount).toBe(3)
    expect(character.inventory).toEqual([])
  })
})

describe('applyCommand: BUY_ITEM — stacking consumables', () => {
  it('повторная покупка consumable с тем же templateId увеличивает quantity, а не длину инвентаря', () => {
    const char0 = makeCharacter({ coins: 10, inventory: [] })
    const r1 = applyCommand(char0, { type: 'BUY_ITEM', templateId: 'rations' })
    expect(r1.character.inventory).toHaveLength(1)
    expect(r1.character.coins).toBe(8)
    const r2 = applyCommand(r1.character, { type: 'BUY_ITEM', templateId: 'rations' })
    expect(r2.character.inventory).toHaveLength(1)
    expect(r2.character.inventory[0].quantity).toBe(2)
    expect(r2.character.coins).toBe(6)
  })
  it('монеты clamp\'ятся к 0 при нехватке', () => {
    const char = makeCharacter({ coins: 3 })
    const { character } = applyCommand(char, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    expect(character.coins).toBe(0)
  })
})

describe('applyCommand: RECEIVE_ITEM — stacking consumables', () => {
  it('при получении consumable с известным templateId — складывается в существующий', () => {
    const existing: InventoryItem = {
      id: 'rat-1',
      templateId: 'rations',
      name: 'Дорожный паёк',
      descriptor: { kind: 'gear', consumable: true },
      quantity: 1,
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        templateId: 'rations',
        name: 'Дорожный паёк',
        descriptor: { kind: 'gear', consumable: true },
        quantity: 3,
      },
    })
    expect(character.inventory).toHaveLength(1)
    expect(character.inventory[0].quantity).toBe(4)
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM — guard', () => {
  it('не custom — поля не меняются, change не пишется', () => {
    const weapon = makeWeapon({ name: 'Меч' })
    const char = makeCharacter({ inventory: [weapon] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: weapon.id,
      name: 'Попытка переименовать',
    })
    expect(character.inventory[0].name).toBe('Меч')
    // Никаких реальных изменений нет — journal тоже должен быть пуст.
    expect(changes).toEqual([])
  })
  it('consumable:false затирает quantity у custom-предмета', () => {
    const item = makeCustom(true, { name: 'Зелье', quantity: 5 })
    const char = makeCharacter({ inventory: [item] })
    const { character } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'Зелье',
      consumable: false,
      quantity: 5,
    })
    const edited = character.inventory[0]
    expect(edited.quantity).toBeUndefined()
    expect(edited.descriptor).toEqual({ kind: 'custom', consumable: false })
  })
  it('custom consumable — сохраняет quantity из команды', () => {
    const item = makeCustom(true, { name: 'Зелье', quantity: 1 })
    const char = makeCharacter({ inventory: [item] })
    const { character } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'Зелье+',
      consumable: true,
      quantity: 5,
      price: 3,
      notes: 'заметка',
    })
    const edited = character.inventory[0]
    expect(edited.name).toBe('Зелье+')
    expect(edited.quantity).toBe(5)
    expect(edited.price).toBe(3)
    expect(edited.notes).toBe('заметка')
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM — guards', () => {
  it('несуществующий itemId — без изменений и без change', () => {
    const item = makeCustom(false, { name: 'Артефакт' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: 'no-such',
      name: 'Новое',
    })
    expect(character.inventory[0].name).toBe('Артефакт')
    expect(changes).toEqual([])
  })
})

describe('applyCommand: ADD_CUSTOM_ITEM — consumable edge cases', () => {
  it('consumable=true без quantity — quantity остаётся undefined', () => {
    const { character } = applyCommand(makeCharacter(), {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Зелье',
      consumable: true,
    })
    const item = character.inventory[0]
    expect(item.quantity).toBeUndefined()
    expect(item.descriptor).toEqual({ kind: 'custom', consumable: true })
  })
})

describe('applyCommand: RECEIVE_ITEM — не-стекающиеся кейсы', () => {
  it('non-consumable с тем же templateId — создаётся отдельный предмет', () => {
    const existing: InventoryItem = {
      id: 'sword-1',
      templateId: 'light_weapon',
      name: 'Лёгкое оружие',
      descriptor: { kind: 'weapon', melee: true },
      damage: 'd6',
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        templateId: 'light_weapon',
        name: 'Лёгкое оружие',
        descriptor: { kind: 'weapon', melee: true },
        damage: 'd6',
      },
    })
    expect(character.inventory).toHaveLength(2)
  })
  it('consumable без templateId — создаётся новый предмет, не стекается', () => {
    const existing: InventoryItem = {
      id: 'rat-1',
      templateId: 'rations',
      name: 'Дорожный паёк',
      descriptor: { kind: 'gear', consumable: true },
      quantity: 1,
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        name: 'Ягоды',
        descriptor: { kind: 'gear', consumable: true },
        quantity: 2,
      },
    })
    expect(character.inventory).toHaveLength(2)
    expect(character.inventory[0].quantity).toBe(1)
  })
})

describe('applyCommand: APPLY_DAMAGE / HEAL — отрицательный amount', () => {
  it('APPLY_DAMAGE с отрицательным amount — no-op', () => {
    const char = makeCharacter({ currentHp: 3, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: -2 })
    expect(character.currentHp).toBe(3)
    expect(changes).toEqual([])
  })
  it('HEAL с отрицательным amount — no-op', () => {
    const char = makeCharacter({ currentHp: 3, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: -2 })
    expect(character.currentHp).toBe(3)
    expect(changes).toEqual([])
  })
  it('APPLY_DAMAGE не может увести HP выше maxHp (никогда не лечит)', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: -10 })
    expect(character.currentHp).toBe(5)
  })
  it('HEAL не может увести HP ниже 0 (никогда не ранит)', () => {
    const char = makeCharacter({ currentHp: 1, maxHp: 5 })
    const { character } = applyCommand(char, { type: 'HEAL', amount: -10 })
    expect(character.currentHp).toBe(1)
  })
})

describe('applyCommand: EQUIP_ITEM / UNEQUIP_ITEM', () => {
  it('EQUIP помечает equipped:true', () => {
    const item = makeWeapon({ equipped: false })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'EQUIP_ITEM', itemId: item.id })
    expect(character.inventory[0].equipped).toBe(true)
    expect(changes[0].payload.kind).toBe('equip')
  })
  it('UNEQUIP помечает equipped:false', () => {
    const item = makeArmor('full', { equipped: true })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'UNEQUIP_ITEM', itemId: item.id })
    expect(character.inventory[0].equipped).toBe(false)
    expect(changes[0].payload.kind).toBe('unequip')
  })
})

describe('applyCommand: SET_COINS', () => {
  it('меняет монеты и пишет дельту', () => {
    const char = makeCharacter({ coins: 10 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: 25 })
    expect(character.coins).toBe(25)
    expect(changes[0].payload).toMatchObject({ kind: 'coins', before: 10, after: 25 })
  })
  it('без изменения значения — без change', () => {
    const char = makeCharacter({ coins: 10 })
    const { changes } = applyCommand(char, { type: 'SET_COINS', amount: 10 })
    expect(changes).toEqual([])
  })
  it('отрицательный amount — clamp в 0', () => {
    const char = makeCharacter({ coins: 10 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: -5 })
    expect(character.coins).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'coins', before: 10, after: 0 })
  })
  it('отрицательный amount при coins=0 — без change (clamp no-op)', () => {
    const char = makeCharacter({ coins: 0 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: -5 })
    expect(character.coins).toBe(0)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: APPLY_DAMAGE', () => {
  it('обычный урон', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 3 })
    expect(character.currentHp).toBe(2)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-damage', amount: 3, hpBefore: 5, hpAfter: 2 })
  })
  it('HP уже 0 — без change', () => {
    const char = makeCharacter({ currentHp: 0 })
    const { changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 3 })
    expect(changes).toEqual([])
  })
  it('amount = 0 при живом HP — без change', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 0 })
    expect(character.currentHp).toBe(5)
    expect(changes).toEqual([])
  })
  it('урон больше currentHp — clamp в 0, delta показывает фактический урон', () => {
    const char = makeCharacter({ currentHp: 2, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 10 })
    expect(character.currentHp).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-damage', hpBefore: 2, hpAfter: 0 })
  })
})

describe('applyCommand: HEAL', () => {
  it('обычное лечение', () => {
    const char = makeCharacter({ currentHp: 1, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 2 })
    expect(character.currentHp).toBe(3)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-heal', amount: 2, before: 1, after: 3 })
  })
  it('переполнение clamp\'ится в maxHp', () => {
    const char = makeCharacter({ currentHp: 4, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 999 })
    expect(character.currentHp).toBe(5)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-heal', before: 4, after: 5 })
  })
  it('лечение при полном HP — без change', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 3 })
    expect(character.currentHp).toBe(5)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: GAIN_XP', () => {
  it('добавляет XP и пишет дельту', () => {
    const char = makeCharacter({ xp: 100 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: 50 })
    expect(character.xp).toBe(150)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 100, after: 150 })
  })
  it('отрицательная дельта — payload отражает before/after', () => {
    const char = makeCharacter({ xp: 100 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: -30 })
    expect(character.xp).toBe(70)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 100, after: 70 })
  })
  it('clamp в 0 при перерасходе, payload отражает фактическое after', () => {
    const char = makeCharacter({ xp: 10 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: -999 })
    expect(character.xp).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 10, after: 0 })
  })
  it('amount = 0 — без change', () => {
    const { changes } = applyCommand(makeCharacter({ xp: 100 }), { type: 'GAIN_XP', amount: 0 })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: LEVEL_UP', () => {
  it('применяет patch и пишет change', () => {
    const char = makeCharacter({ level: 1, maxHp: 6, currentHp: 6 })
    const patch: LevelUpPatch = {
      level: 2,
      maxHp: 10,
      currentHp: 10,
      hitDice: 2,
      hpHistory: [{ level: 2, roll: 4, source: 'dice' }],
      skillIds: [],
      abilityIds: [],
      stats: char.stats,
      damageBonusDice: 0,
    }
    const { character, changes } = applyCommand(char, { type: 'LEVEL_UP', patch })
    expect(character.level).toBe(2)
    expect(character.maxHp).toBe(10)
    expect(changes[0].payload).toMatchObject({ kind: 'level-up', before: 1, after: 2 })
  })
  it('без patch.magic — существующая магия не затирается', () => {
    const existingMagic: Magic = { spirits: [], rituals: [], cantrips: ['Старое'] }
    const char = makeCharacter({ level: 1, magic: existingMagic })
    const patch: LevelUpPatch = {
      level: 2,
      maxHp: 10,
      currentHp: 10,
      hitDice: 2,
      hpHistory: [],
      skillIds: [],
      abilityIds: [],
      stats: char.stats,
      damageBonusDice: 0,
    }
    const { character } = applyCommand(char, { type: 'LEVEL_UP', patch })
    expect(character.magic).toEqual(existingMagic)
  })
  it('с patch.magic — магия обновляется', () => {
    const char = makeCharacter({ level: 1 })
    const newMagic: Magic = { spirits: [], rituals: [], cantrips: ['Новое'] }
    const patch: LevelUpPatch = {
      level: 2,
      maxHp: 10,
      currentHp: 10,
      hitDice: 2,
      hpHistory: [],
      skillIds: [],
      abilityIds: [],
      stats: char.stats,
      damageBonusDice: 0,
      magic: newMagic,
    }
    const { character } = applyCommand(char, { type: 'LEVEL_UP', patch })
    expect(character.magic).toEqual(newMagic)
  })
  it('patch полностью заменяет skillIds, abilityIds и damageBonusDice', () => {
    const char = makeCharacter({
      level: 1,
      skillIds: ['athletics'],
      abilityIds: ['sturdy'],
      damageBonusDice: 0,
    })
    const patch: LevelUpPatch = {
      level: 5,
      maxHp: 20,
      currentHp: 20,
      hitDice: 4,
      hpHistory: [],
      skillIds: ['awareness', 'healing'],
      abilityIds: ['luck'],
      stats: char.stats,
      damageBonusDice: 2,
    }
    const { character, changes } = applyCommand(char, { type: 'LEVEL_UP', patch })
    expect(character.skillIds).toEqual(['awareness', 'healing'])
    expect(character.abilityIds).toEqual(['luck'])
    expect(character.damageBonusDice).toBe(2)
    expect(character.hitDice).toBe(4)
    expect(changes[0].payload).toMatchObject({ kind: 'level-up', before: 1, after: 5 })
  })
})

describe('applyCommand: UPDATE_MAGIC', () => {
  it('записывает новую магию', () => {
    const magic: Magic = { spirits: [], rituals: [], cantrips: ['Свеча'] }
    const { character, changes } = applyCommand(makeCharacter(), { type: 'UPDATE_MAGIC', magic })
    expect(character.magic).toEqual(magic)
    expect(changes[0].payload.kind).toBe('magic')
  })
})

describe('applyCommand: UPDATE_STATS', () => {
  it('пишет diff по изменённым статам', () => {
    const char = makeCharacter()
    const { character, changes } = applyCommand(char, {
      type: 'UPDATE_STATS',
      stats: { ...char.stats, str: 2, dex: 1 },
    })
    expect(character.stats.str).toBe(2)
    expect(changes[0].payload.kind).toBe('stats')
    const statsPayload = changes[0].payload as { kind: 'stats'; changes: { key: string; before: number; after: number }[] }
    expect(statsPayload.changes).toEqual(
      expect.arrayContaining([
        { key: 'str', before: 0, after: 2 },
        { key: 'dex', before: 0, after: 1 },
      ]),
    )
  })
  it('без изменений — без change', () => {
    const char = makeCharacter()
    const { changes } = applyCommand(char, { type: 'UPDATE_STATS', stats: { ...char.stats } })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: UPDATE_NOTES', () => {
  it('обновляет notes без change', () => {
    const { character, changes } = applyCommand(makeCharacter(), {
      type: 'UPDATE_NOTES',
      notes: 'hi',
    })
    expect(character.notes).toBe('hi')
    expect(changes).toEqual([])
  })
})

describe('applyCommand: RESET_QUICKSILVER', () => {
  it('сбрасывает в 0 и пишет change если было > 0', () => {
    const char = makeCharacter({ quicksilverCount: 3 })
    const { character, changes } = applyCommand(char, { type: 'RESET_QUICKSILVER' })
    expect(character.quicksilverCount).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'quicksilver-reset', before: 3 })
  })
  it('count === 0 — без change', () => {
    const char = makeCharacter({ quicksilverCount: 0 })
    const { changes } = applyCommand(char, { type: 'RESET_QUICKSILVER' })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: FINALIZE_CHARACTER', () => {
  it('меняет статус на active', () => {
    const char = makeCharacter({ status: 'draft', name: 'Гном' })
    const { character, changes } = applyCommand(char, { type: 'FINALIZE_CHARACTER' })
    expect(character.status).toBe('active')
    expect(changes[0].payload).toMatchObject({ kind: 'create', characterName: 'Гном' })
  })
  it('пустое имя → payload с прочерком', () => {
    const { changes } = applyCommand(makeCharacter({ status: 'draft', name: '' }), {
      type: 'FINALIZE_CHARACTER',
    })
    expect(changes[0].payload).toMatchObject({ kind: 'create', characterName: '—' })
  })
})

describe('applyCommand: guards на несуществующий itemId', () => {
  it('REMOVE_ITEM — без change, инвентарь не меняется', () => {
    const item = makeWeapon()
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'REMOVE_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory).toEqual([item])
    expect(changes).toEqual([])
  })
  it('USE_ITEM — без change, инвентарь не меняется', () => {
    const item = makeCustom(true, { quantity: 2 })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'USE_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory[0].quantity).toBe(2)
    expect(changes).toEqual([])
  })
  it('EQUIP_ITEM — без change', () => {
    const item = makeWeapon({ equipped: false })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EQUIP_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory[0].equipped).toBe(false)
    expect(changes).toEqual([])
  })
  it('UNEQUIP_ITEM — без change', () => {
    const item = makeArmor('full', { equipped: true })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'UNEQUIP_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory[0].equipped).toBe(true)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: BUY_ITEM — non-consumable не стекается', () => {
  it('повторная покупка оружия → два отдельных предмета', () => {
    const char0 = makeCharacter({ coins: 100, inventory: [] })
    const r1 = applyCommand(char0, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    const r2 = applyCommand(r1.character, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    expect(r2.character.inventory).toHaveLength(2)
    expect(r2.character.inventory.every(i => i.quantity === undefined)).toBe(true)
  })
})
