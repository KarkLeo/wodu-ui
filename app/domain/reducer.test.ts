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
  it('buying an existing template deducts coins and adds the item', () => {
    const char = makeCharacter({ coins: 50 })
    const { character, changes } = applyCommand(char, {
      type: 'BUY_ITEM',
      templateId: 'light_weapon',
    })
    expect(character.coins).toBe(40)
    expect(character.inventory).toHaveLength(1)
    expect(changes).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'buy', cost: 10 })
  })
  it('links a bought item to its catalog template', () => {
    const char = makeCharacter({ coins: 100 })
    const { character } = applyCommand(char, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    const item = character.inventory.at(-1)!
    expect(item.templateId).toBe('light_weapon')
    expect(item.damage).toBe('1d6')
  })
  it('an unknown template leaves the character untouched and writes no changes', () => {
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
  it('adds the item and writes a change', () => {
    const char = makeCharacter()
    const { character, changes } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: { name: 'Gift', descriptor: { kind: 'gear' } },
    })
    expect(character.inventory).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'receive', itemName: 'Gift' })
  })
})

describe('applyCommand: ADD_CUSTOM_ITEM', () => {
  it('deducts the price and writes a change', () => {
    const char = makeCharacter({ coins: 20 })
    const { character, changes } = applyCommand(char, {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Artifact',
      price: 5,
    })
    expect(character.coins).toBe(15)
    expect(character.inventory).toHaveLength(1)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'custom', cost: 5 })
  })
  it('no price — payload without cost', () => {
    const { changes } = applyCommand(makeCharacter(), {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Gift',
    })
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-add', source: 'custom', itemName: 'Gift' })
    expect((changes[0].payload as { cost?: number }).cost).toBeUndefined()
  })
  it('price above the coin balance — coins clamp to 0', () => {
    const char = makeCharacter({ coins: 5 })
    const { character } = applyCommand(char, {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Expensive',
      price: 20,
    })
    expect(character.coins).toBe(0)
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM', () => {
  it('edits the name of a custom item', () => {
    const item = makeCustom(false, { name: 'old' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'new',
    })
    expect(character.inventory[0].name).toBe('new')
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-edit', itemName: 'new' })
  })
})

describe('applyCommand: REMOVE_ITEM', () => {
  it('removes it and writes a change', () => {
    const item = makeWeapon()
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'REMOVE_ITEM', itemId: item.id })
    expect(character.inventory).toEqual([])
    expect(changes[0].payload.kind).toBe('inventory-remove')
  })
})

describe('applyCommand: USE_ITEM', () => {
  it('quantity > 1 — decrements by 1, the label shows x→x', () => {
    const item = makeCustom(true, { quantity: 3, name: 'Potion' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'USE_ITEM', itemId: item.id })
    expect(character.inventory[0].quantity).toBe(2)
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-use', itemName: 'Potion', quantityBefore: 3, quantityAfter: 2 })
  })
  it('quantity === 1 — removes the item', () => {
    const item = makeCustom(true, { quantity: 1, name: 'Potion' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'USE_ITEM', itemId: item.id })
    expect(character.inventory).toEqual([])
    expect(changes[0].payload).toMatchObject({ kind: 'inventory-use', itemName: 'Potion', quantityBefore: 1 })
  })
  it('mercury — increments quicksilverCount (undefined → 1)', () => {
    const mercury: InventoryItem = {
      id: 'mercury-1',
      templateId: 'mercury',
      name: 'Mercury (dose)',
      descriptor: { kind: 'occult', consumable: true },
      quantity: 2,
    }
    const char = makeCharacter({ inventory: [mercury] })
    expect(char.quicksilverCount).toBeUndefined()
    const { character } = applyCommand(char, { type: 'USE_ITEM', itemId: mercury.id })
    expect(character.quicksilverCount).toBe(1)
    expect(character.inventory[0].quantity).toBe(1)
  })
  it('mercury — increments cumulatively from an existing count', () => {
    const mercury: InventoryItem = {
      id: 'mercury-2',
      templateId: 'mercury',
      name: 'Mercury (dose)',
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
  it('buying the same consumable templateId again raises quantity, not inventory length', () => {
    const char0 = makeCharacter({ coins: 10, inventory: [] })
    const r1 = applyCommand(char0, { type: 'BUY_ITEM', templateId: 'rations' })
    expect(r1.character.inventory).toHaveLength(1)
    expect(r1.character.coins).toBe(8)
    const r2 = applyCommand(r1.character, { type: 'BUY_ITEM', templateId: 'rations' })
    expect(r2.character.inventory).toHaveLength(1)
    expect(r2.character.inventory[0].quantity).toBe(2)
    expect(r2.character.coins).toBe(6)
  })
  it('coins clamp to 0 when there are not enough', () => {
    const char = makeCharacter({ coins: 3 })
    const { character } = applyCommand(char, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    expect(character.coins).toBe(0)
  })
})

describe('applyCommand: RECEIVE_ITEM — stacking consumables', () => {
  it('receiving a consumable with a known templateId stacks onto the existing one', () => {
    const existing: InventoryItem = {
      id: 'rat-1',
      templateId: 'rations',
      name: 'Rations',
      descriptor: { kind: 'gear', consumable: true },
      quantity: 1,
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        templateId: 'rations',
        name: 'Rations',
        descriptor: { kind: 'gear', consumable: true },
        quantity: 3,
      },
    })
    expect(character.inventory).toHaveLength(1)
    expect(character.inventory[0].quantity).toBe(4)
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM — guard', () => {
  it('not custom — fields stay untouched and no change is written', () => {
    const weapon = makeWeapon({ name: 'Sword' })
    const char = makeCharacter({ inventory: [weapon] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: weapon.id,
      name: 'Rename attempt',
    })
    expect(character.inventory[0].name).toBe('Sword')
    // Nothing actually changed, so the journal must stay empty too.
    expect(changes).toEqual([])
  })
  it('consumable:false wipes quantity on a custom item', () => {
    const item = makeCustom(true, { name: 'Potion', quantity: 5 })
    const char = makeCharacter({ inventory: [item] })
    const { character } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'Potion',
      consumable: false,
      quantity: 5,
    })
    const edited = character.inventory[0]
    expect(edited.quantity).toBeUndefined()
    expect(edited.descriptor).toEqual({ kind: 'custom', consumable: false })
  })
  it('custom consumable — keeps the quantity from the command', () => {
    const item = makeCustom(true, { name: 'Potion', quantity: 1 })
    const char = makeCharacter({ inventory: [item] })
    const { character } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: item.id,
      name: 'Potion+',
      consumable: true,
      quantity: 5,
      price: 3,
      notes: 'note',
    })
    const edited = character.inventory[0]
    expect(edited.name).toBe('Potion+')
    expect(edited.quantity).toBe(5)
    expect(edited.price).toBe(3)
    expect(edited.notes).toBe('note')
  })
})

describe('applyCommand: EDIT_CUSTOM_ITEM — guards', () => {
  it('unknown itemId — no changes and no change entry', () => {
    const item = makeCustom(false, { name: 'Artifact' })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EDIT_CUSTOM_ITEM',
      itemId: 'no-such',
      name: 'New',
    })
    expect(character.inventory[0].name).toBe('Artifact')
    expect(changes).toEqual([])
  })
})

describe('applyCommand: ADD_CUSTOM_ITEM — consumable edge cases', () => {
  it('consumable=true without quantity — quantity stays undefined', () => {
    const { character } = applyCommand(makeCharacter(), {
      type: 'ADD_CUSTOM_ITEM',
      name: 'Potion',
      consumable: true,
    })
    const item = character.inventory[0]
    expect(item.quantity).toBeUndefined()
    expect(item.descriptor).toEqual({ kind: 'custom', consumable: true })
  })
})

describe('applyCommand: RECEIVE_ITEM — non-stacking cases', () => {
  it('non-consumable with the same templateId — a separate item is created', () => {
    const existing: InventoryItem = {
      id: 'sword-1',
      templateId: 'light_weapon',
      name: 'Light weapon',
      descriptor: { kind: 'weapon', melee: true },
      damage: 'd6',
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        templateId: 'light_weapon',
        name: 'Light weapon',
        descriptor: { kind: 'weapon', melee: true },
        damage: 'd6',
      },
    })
    expect(character.inventory).toHaveLength(2)
  })
  it('consumable without a templateId — a new item is created, nothing stacks', () => {
    const existing: InventoryItem = {
      id: 'rat-1',
      templateId: 'rations',
      name: 'Rations',
      descriptor: { kind: 'gear', consumable: true },
      quantity: 1,
    }
    const char = makeCharacter({ inventory: [existing] })
    const { character } = applyCommand(char, {
      type: 'RECEIVE_ITEM',
      item: {
        name: 'Berries',
        descriptor: { kind: 'gear', consumable: true },
        quantity: 2,
      },
    })
    expect(character.inventory).toHaveLength(2)
    expect(character.inventory[0].quantity).toBe(1)
  })
})

describe('applyCommand: APPLY_DAMAGE / HEAL — negative amount', () => {
  it('APPLY_DAMAGE with a negative amount — no-op', () => {
    const char = makeCharacter({ currentHp: 3, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: -2 })
    expect(character.currentHp).toBe(3)
    expect(changes).toEqual([])
  })
  it('HEAL with a negative amount — no-op', () => {
    const char = makeCharacter({ currentHp: 3, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: -2 })
    expect(character.currentHp).toBe(3)
    expect(changes).toEqual([])
  })
  it('APPLY_DAMAGE cannot push HP above maxHp (it never heals)', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: -10 })
    expect(character.currentHp).toBe(5)
  })
  it('HEAL cannot push HP below 0 (it never wounds)', () => {
    const char = makeCharacter({ currentHp: 1, maxHp: 5 })
    const { character } = applyCommand(char, { type: 'HEAL', amount: -10 })
    expect(character.currentHp).toBe(1)
  })
})

describe('applyCommand: EQUIP_ITEM / UNEQUIP_ITEM', () => {
  it('EQUIP marks equipped:true', () => {
    const item = makeWeapon({ equipped: false })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'EQUIP_ITEM', itemId: item.id })
    expect(character.inventory[0].equipped).toBe(true)
    expect(changes[0].payload.kind).toBe('equip')
  })
  it('UNEQUIP marks equipped:false', () => {
    const item = makeArmor('full', { equipped: true })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, { type: 'UNEQUIP_ITEM', itemId: item.id })
    expect(character.inventory[0].equipped).toBe(false)
    expect(changes[0].payload.kind).toBe('unequip')
  })
})

describe('applyCommand: SET_COINS', () => {
  it('changes coins and writes the delta', () => {
    const char = makeCharacter({ coins: 10 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: 25 })
    expect(character.coins).toBe(25)
    expect(changes[0].payload).toMatchObject({ kind: 'coins', before: 10, after: 25 })
  })
  it('value unchanged — no change', () => {
    const char = makeCharacter({ coins: 10 })
    const { changes } = applyCommand(char, { type: 'SET_COINS', amount: 10 })
    expect(changes).toEqual([])
  })
  it('negative amount — clamps to 0', () => {
    const char = makeCharacter({ coins: 10 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: -5 })
    expect(character.coins).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'coins', before: 10, after: 0 })
  })
  it('negative amount at coins=0 — no change (clamp no-op)', () => {
    const char = makeCharacter({ coins: 0 })
    const { character, changes } = applyCommand(char, { type: 'SET_COINS', amount: -5 })
    expect(character.coins).toBe(0)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: APPLY_DAMAGE', () => {
  it('plain damage', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 3 })
    expect(character.currentHp).toBe(2)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-damage', amount: 3, hpBefore: 5, hpAfter: 2 })
  })
  it('HP already 0 — no change', () => {
    const char = makeCharacter({ currentHp: 0 })
    const { changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 3 })
    expect(changes).toEqual([])
  })
  it('amount = 0 on a living character — no change', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 0 })
    expect(character.currentHp).toBe(5)
    expect(changes).toEqual([])
  })
  it('damage above currentHp — clamps to 0, delta reports the damage actually taken', () => {
    const char = makeCharacter({ currentHp: 2, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'APPLY_DAMAGE', amount: 10 })
    expect(character.currentHp).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-damage', hpBefore: 2, hpAfter: 0 })
  })
})

describe('applyCommand: HEAL', () => {
  it('plain healing', () => {
    const char = makeCharacter({ currentHp: 1, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 2 })
    expect(character.currentHp).toBe(3)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-heal', amount: 2, before: 1, after: 3 })
  })
  it('overflow clamps to maxHp', () => {
    const char = makeCharacter({ currentHp: 4, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 999 })
    expect(character.currentHp).toBe(5)
    expect(changes[0].payload).toMatchObject({ kind: 'hp-heal', before: 4, after: 5 })
  })
  it('healing at full HP — no change', () => {
    const char = makeCharacter({ currentHp: 5, maxHp: 5 })
    const { character, changes } = applyCommand(char, { type: 'HEAL', amount: 3 })
    expect(character.currentHp).toBe(5)
    expect(changes).toEqual([])
  })
})

describe('applyCommand: GAIN_XP', () => {
  it('adds XP and writes the delta', () => {
    const char = makeCharacter({ xp: 100 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: 50 })
    expect(character.xp).toBe(150)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 100, after: 150 })
  })
  it('negative delta — the payload reflects before/after', () => {
    const char = makeCharacter({ xp: 100 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: -30 })
    expect(character.xp).toBe(70)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 100, after: 70 })
  })
  it('clamps to 0 on overspend, the payload reflects the actual after value', () => {
    const char = makeCharacter({ xp: 10 })
    const { character, changes } = applyCommand(char, { type: 'GAIN_XP', amount: -999 })
    expect(character.xp).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'xp-gain', before: 10, after: 0 })
  })
  it('amount = 0 — no change', () => {
    const { changes } = applyCommand(makeCharacter({ xp: 100 }), { type: 'GAIN_XP', amount: 0 })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: LEVEL_UP', () => {
  it('applies the patch and writes a change', () => {
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
  it('no patch.magic — existing magic is not wiped', () => {
    const existingMagic: Magic = { spirits: [], rituals: [], cantrips: ['Old'] }
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
  it('with patch.magic — magic is updated', () => {
    const char = makeCharacter({ level: 1 })
    const newMagic: Magic = { spirits: [], rituals: [], cantrips: ['New'] }
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
  it('the patch fully replaces skillIds, abilityIds and damageBonusDice', () => {
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
  it('writes the new magic', () => {
    const magic: Magic = { spirits: [], rituals: [], cantrips: ['Candle'] }
    const { character, changes } = applyCommand(makeCharacter(), { type: 'UPDATE_MAGIC', magic })
    expect(character.magic).toEqual(magic)
    expect(changes[0].payload.kind).toBe('magic')
  })
})

describe('applyCommand: UPDATE_STATS', () => {
  it('writes a diff for the stats that changed', () => {
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
  it('nothing changed — no change', () => {
    const char = makeCharacter()
    const { changes } = applyCommand(char, { type: 'UPDATE_STATS', stats: { ...char.stats } })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: UPDATE_NOTES', () => {
  it('updates notes without writing a change', () => {
    const { character, changes } = applyCommand(makeCharacter(), {
      type: 'UPDATE_NOTES',
      notes: 'hi',
    })
    expect(character.notes).toBe('hi')
    expect(changes).toEqual([])
  })
})

describe('applyCommand: RESET_QUICKSILVER', () => {
  it('resets to 0 and writes a change when it was > 0', () => {
    const char = makeCharacter({ quicksilverCount: 3 })
    const { character, changes } = applyCommand(char, { type: 'RESET_QUICKSILVER' })
    expect(character.quicksilverCount).toBe(0)
    expect(changes[0].payload).toMatchObject({ kind: 'quicksilver-reset', before: 3 })
  })
  it('count === 0 — no change', () => {
    const char = makeCharacter({ quicksilverCount: 0 })
    const { changes } = applyCommand(char, { type: 'RESET_QUICKSILVER' })
    expect(changes).toEqual([])
  })
})

describe('applyCommand: FINALIZE_CHARACTER', () => {
  it('switches the status to active', () => {
    const char = makeCharacter({ status: 'draft', name: 'Dwarf' })
    const { character, changes } = applyCommand(char, { type: 'FINALIZE_CHARACTER' })
    expect(character.status).toBe('active')
    expect(changes[0].payload).toMatchObject({ kind: 'create', characterName: 'Dwarf' })
  })
  it('empty name → payload falls back to a dash', () => {
    const { changes } = applyCommand(makeCharacter({ status: 'draft', name: '' }), {
      type: 'FINALIZE_CHARACTER',
    })
    expect(changes[0].payload).toMatchObject({ kind: 'create', characterName: '—' })
  })
})

describe('applyCommand: guards against an unknown itemId', () => {
  it('REMOVE_ITEM — no change, inventory untouched', () => {
    const item = makeWeapon()
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'REMOVE_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory).toEqual([item])
    expect(changes).toEqual([])
  })
  it('USE_ITEM — no change, inventory untouched', () => {
    const item = makeCustom(true, { quantity: 2 })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'USE_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory[0].quantity).toBe(2)
    expect(changes).toEqual([])
  })
  it('EQUIP_ITEM — no change', () => {
    const item = makeWeapon({ equipped: false })
    const char = makeCharacter({ inventory: [item] })
    const { character, changes } = applyCommand(char, {
      type: 'EQUIP_ITEM',
      itemId: 'no-such',
    })
    expect(character.inventory[0].equipped).toBe(false)
    expect(changes).toEqual([])
  })
  it('UNEQUIP_ITEM — no change', () => {
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

describe('applyCommand: BUY_ITEM — non-consumable does not stack', () => {
  it('buying the same weapon twice → two separate items', () => {
    const char0 = makeCharacter({ coins: 100, inventory: [] })
    const r1 = applyCommand(char0, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    const r2 = applyCommand(r1.character, { type: 'BUY_ITEM', templateId: 'light_weapon' })
    expect(r2.character.inventory).toHaveLength(2)
    expect(r2.character.inventory.every(i => i.quantity === undefined)).toBe(true)
  })
})
