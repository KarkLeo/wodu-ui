import { describe, expect, it } from 'vitest'
import type { LibraryMonster } from '@/types/library'
import type { EncounterHit, EncounterMonster, EncounterState, TableSelection } from '@/types/encounter'
import type { RollRecord } from '@/types/dice'
import {
  addInstance, applyInstanceEdit, canApplyRoll, changeHp, checkEncounterHit, checkEncounterMonster,
  checkEncounterState, damageAfterArmor, emptyEncounter, isStaleMonster, killMonster, monsterLabel,
  moveInOrder, orderMonsters, previewHit, reviveMonster, setHp, switchSortMode, toggleCondition, touch,
} from '@/domain/encounter'

const goblin: LibraryMonster = { id: 'starter-goblin', name: 'Goblin', hp: 4, armor: 1, damage: '1d6', special: 'Sneaky', notes: 'n' }
const orc: LibraryMonster = { id: 'orc', name: 'Orc', hp: 8, armor: 2, damage: '1d8' }

function mon(over: Partial<EncounterMonster> = {}): EncounterMonster {
  return { id: 'm', sourceId: 's', n: 1, name: 'Goblin', hp: 4, maxHp: 4, armor: 1, damage: '1d6', conditions: [], touchedAt: 1, ...over }
}

describe('addInstance', () => {
  it('numbers per source, from 1, and never reuses', () => {
    let state = emptyEncounter('g')
    const a = addInstance(state, goblin, 'a', 1); state = a.state
    const b = addInstance(state, goblin, 'b', 2); state = b.state
    const c = addInstance(state, orc, 'c', 3); state = c.state
    expect([a.monster.n, b.monster.n, c.monster.n]).toEqual([1, 2, 1])
    expect(addInstance(state, goblin, 'd', 4).monster.n).toBe(3)
    expect(state.manualOrder).toEqual(['c', 'b', 'a'])
  })

  it('snapshots the entry: hp becomes hp and maxHp, starter ids stay as sourceId', () => {
    const { monster, state } = addInstance(emptyEncounter('g'), goblin, 'a', 9)
    expect(monster).toEqual({
      id: 'a', sourceId: 'starter-goblin', n: 1, name: 'Goblin', hp: 4, maxHp: 4, armor: 1,
      damage: '1d6', special: 'Sneaky', notes: 'n', conditions: [], touchedAt: 9,
    })
    expect(state.counters).toEqual({ 'starter-goblin': 1 })
  })

  it('does not mutate the previous state', () => {
    const s = emptyEncounter('g')
    addInstance(s, goblin, 'a', 1)
    expect(s).toEqual({ id: 'g', sortMode: 'auto', manualOrder: [], counters: {} })
  })
})

it('labels an instance with its number', () => {
  expect(monsterLabel(mon({ n: 3 }))).toBe('Goblin #3')
})

describe('hp', () => {
  it('kills at hp 0 and revives above it', () => {
    const m = mon()
    const dead = setHp(m, 0, 5)
    expect(dead.diedAt).toBe(5)
    expect(setHp(dead, 2, 6).diedAt).toBeUndefined()
    expect(reviveMonster(dead, 7)).toMatchObject({ hp: 1, touchedAt: 7 })
    expect(reviveMonster(dead, 7).diedAt).toBeUndefined()
    expect(killMonster(m, 8)).toMatchObject({ hp: 0, diedAt: 8 })
  })

  it('clamps hp to 0..maxHp', () => {
    const m = mon()
    expect(setHp(m, 99, 2).hp).toBe(4)
    expect(setHp(m, -5, 2).hp).toBe(0)
    expect(changeHp(m, -2, 2).hp).toBe(2)
    expect(changeHp(m, 10, 2).hp).toBe(4)
    expect(changeHp(m, -10, 2)).toMatchObject({ hp: 0, diedAt: 2 })
  })

  it('a later HP-0 write keeps the first diedAt', () => {
    const dead = setHp(mon(), 0, 5)
    const again = setHp(dead, 0, 9)
    expect(again.diedAt).toBe(5)
    expect(killMonster(dead, 10).diedAt).toBe(5)
    expect(again.touchedAt).toBe(9)
  })
})

it('toggles a condition and touches', () => {
  const on = toggleCondition(mon(), 'prone', 4)
  expect(on.conditions).toEqual(['prone'])
  expect(on.touchedAt).toBe(4)
  expect(toggleCondition(on, 'prone', 5).conditions).toEqual([])
})

describe('touchedAt with a clock behind', () => {
  // The other device's clock ran ahead, so the row is newer than this device's now.
  const ahead = mon({ touchedAt: 1000 })

  it('every change is later than what it replaces', () => {
    expect(touch(ahead, 5).touchedAt).toBe(1001)
    expect(setHp(ahead, 2, 5).touchedAt).toBe(1001)
    expect(changeHp(ahead, -1, 5).touchedAt).toBe(1001)
    expect(killMonster(ahead, 5).touchedAt).toBe(1001)
    expect(reviveMonster(mon({ hp: 0, diedAt: 900, touchedAt: 1000 }), 5).touchedAt).toBe(1001)
    expect(toggleCondition(ahead, 'prone', 5).touchedAt).toBe(1001)
    expect(applyInstanceEdit(ahead, { name: 'X', hp: 4, armor: 0, damage: '1d6' }, 5).touchedAt).toBe(1001)
  })

  it('is not stale on the device whose clock runs ahead', () => {
    expect(isStaleMonster(changeHp(ahead, -1, 5), ahead)).toBe(false)
  })

  it('a normal clock keeps its own time', () => {
    expect(touch(ahead, 2000).touchedAt).toBe(2000)
  })
})

it('touch only bumps touchedAt', () => {
  expect(touch(mon(), 7)).toEqual({ ...mon(), touchedAt: 7 })
})

describe('applyInstanceEdit', () => {
  const draft = { name: 'Big Goblin', hp: 2, armor: 3, damage: '1d8' }

  it('keeps n and sourceId, clamps hp to a lower maxHp, dies at 0', () => {
    const m = mon({ n: 4, sourceId: 'src', hp: 4, maxHp: 4, special: 'x', notes: 'y' })
    const e = applyInstanceEdit(m, draft, 6)
    expect(e).toMatchObject({ n: 4, sourceId: 'src', name: 'Big Goblin', maxHp: 2, hp: 2, armor: 3, damage: '1d8', touchedAt: 6 })
    expect(e.special).toBeUndefined()
    expect(e.notes).toBeUndefined()
    expect(e.diedAt).toBeUndefined()
    const dead = applyInstanceEdit(mon({ hp: 0, diedAt: 3 }), draft, 6)
    expect(dead).toMatchObject({ hp: 0, diedAt: 3 })
  })

  it('keeps a lower hp when maxHp rises', () => {
    expect(applyInstanceEdit(mon({ hp: 1 }), { ...draft, hp: 10 }, 6)).toMatchObject({ hp: 1, maxHp: 10 })
  })
})

describe('orderMonsters', () => {
  const a = mon({ id: 'a', touchedAt: 1 })
  const b = mon({ id: 'b', touchedAt: 3 })
  const c = mon({ id: 'c', touchedAt: 2 })
  const d1 = mon({ id: 'd1', hp: 0, diedAt: 5, touchedAt: 9 })
  const d2 = mon({ id: 'd2', hp: 0, diedAt: 8, touchedAt: 1 })
  const auto = emptyEncounter('g')

  it('auto sorts by touchedAt desc, dead below by diedAt desc', () => {
    const r = orderMonsters([a, d1, b, d2, c], auto)
    expect(r.alive.map(m => m.id)).toEqual(['b', 'c', 'a'])
    expect(r.dead.map(m => m.id)).toEqual(['d2', 'd1'])
  })

  it('manual follows manualOrder, unknown ids on top, dead below in both modes', () => {
    const manual: EncounterState = { ...auto, sortMode: 'manual', manualOrder: ['c', 'a', 'gone'] }
    const r = orderMonsters([a, b, c, d1, d2], manual)
    expect(r.alive.map(m => m.id)).toEqual(['b', 'c', 'a'])
    expect(r.dead.map(m => m.id)).toEqual(['d2', 'd1'])
    const unknown = orderMonsters([a, b, c], { ...manual, manualOrder: ['a'] })
    expect(unknown.alive.map(m => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('a dead id in manualOrder does not appear among alive', () => {
    const manual: EncounterState = { ...auto, sortMode: 'manual', manualOrder: ['d1', 'a'] }
    expect(orderMonsters([a, d1], manual).alive.map(m => m.id)).toEqual(['a'])
  })

  it('switching to manual copies the current auto order every time', () => {
    const list = [a, b, c]
    const s1 = switchSortMode(auto, 'manual', list)
    expect(s1.sortMode).toBe('manual')
    expect(s1.manualOrder).toEqual(orderMonsters(list, auto).alive.map(m => m.id))
    const back = switchSortMode(s1, 'auto', list)
    expect(back.sortMode).toBe('auto')
    const relisted = [{ ...a, touchedAt: 10 }, b, c]
    const s2 = switchSortMode(back, 'manual', relisted)
    expect(s2.manualOrder).toEqual(orderMonsters(relisted, back).alive.map(m => m.id))
    expect(s2.manualOrder).toEqual(['a', 'b', 'c'])
  })
})

it('moves in order', () => {
  expect(moveInOrder(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  expect(moveInOrder(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a'])
  expect(moveInOrder(['a', 'b', 'c'], 'a', 'a')).toEqual(['a', 'b', 'c'])
})

it('armor floors at 0', () => {
  expect(damageAfterArmor(5, 1)).toBe(4)
  expect(damageAfterArmor(1, 3)).toBe(0)
})

it('temp absorbs first', () => {
  expect(previewHit(5, 14, 1)).toEqual({ fromTemp: 1, hpAfter: 10 })
  expect(previewHit(9, 3, 0)).toEqual({ fromTemp: 0, hpAfter: 0 })
  expect(previewHit(2, 14, 5)).toEqual({ fromTemp: 2, hpAfter: 14 })
})

describe('canApplyRoll', () => {
  const roll = (over: Partial<RollRecord> = {}): RollRecord => ({
    id: 'r1', timestamp: 1, notation: '1d6', dice: [], diceTotal: 3, modifier: 0, total: 3, label: '',
    purpose: { kind: 'damage', weaponName: 'Sword', formula: '1d6' }, characterId: 'c1', ...over,
  })
  const byMonster = roll({ monster: { id: 'm1', n: 1 } })
  const monsterSel: TableSelection = { kind: 'monster', id: 'm1' }
  const charSel: TableSelection = { kind: 'character', id: 'c1' }
  const alive = () => false

  it('monster selected: damage by a character only', () => {
    expect(canApplyRoll(roll(), monsterSel, [], alive)).toBe(true)
    expect(canApplyRoll(byMonster, monsterSel, [], alive)).toBe(false)
  })

  it('character selected: damage by a monster only', () => {
    expect(canApplyRoll(byMonster, charSel, [], alive)).toBe(true)
    expect(canApplyRoll(roll(), charSel, [], alive)).toBe(false)
  })

  it('never a stat, free, hp-init or hit-dice roll', () => {
    const purposes: RollRecord['purpose'][] = [
      { kind: 'stat', statKey: 'str', statBonus: 1 },
      { kind: 'free', notation: '1d6' },
      { kind: 'hp-init', level: 1, numDice: 1, kept: 1 },
      { kind: 'hit-dice', fromLevel: 1, toLevel: 2, numDice: 2, kept: 2 },
    ]
    for (const purpose of purposes) {
      expect(canApplyRoll(roll({ purpose }), monsterSel, [], alive)).toBe(false)
      expect(canApplyRoll(roll({ purpose, monster: { id: 'm1', n: 1 } }), charSel, [], alive)).toBe(false)
    }
  })

  it('not when this target already has a hit from this roll; yes for another target', () => {
    const hit: EncounterHit = {
      id: 'h', rollId: 'r1', target: { kind: 'monster', id: 'm1', name: 'Goblin #1' }, sourceName: 'Sword',
      rollTotal: 3, armor: 1, amount: 2, at: 1,
    }
    expect(canApplyRoll(roll(), monsterSel, [hit], alive)).toBe(false)
    expect(canApplyRoll(roll(), { kind: 'monster', id: 'm2' }, [hit], alive)).toBe(true)
    expect(canApplyRoll(roll({ id: 'r2' }), monsterSel, [hit], alive)).toBe(true)
  })

  it('never when nothing is selected, or the selected monster is dead', () => {
    expect(canApplyRoll(roll(), null, [], alive)).toBe(false)
    expect(canApplyRoll(roll(), monsterSel, [], id => id === 'm1')).toBe(false)
  })
})

it('isStaleMonster only for strictly older touchedAt', () => {
  expect(isStaleMonster(mon({ touchedAt: 1 }), mon({ touchedAt: 2 }))).toBe(true)
  expect(isStaleMonster(mon({ touchedAt: 2 }), mon({ touchedAt: 2 }))).toBe(false)
  expect(isStaleMonster(mon({ touchedAt: 3 }), mon({ touchedAt: 2 }))).toBe(false)
})

describe('shape checks', () => {
  it('accept good data', () => {
    const m = mon({ special: 's', diedAt: 4, hp: 0, conditions: ['prone'] })
    expect(checkEncounterMonster(m)).toEqual(m)
    const s = emptyEncounter('g')
    expect(checkEncounterState(s)).toEqual(s)
    const h: EncounterHit = {
      id: 'h', rollId: 'r', target: { kind: 'character', id: 'c', name: 'N' }, sourceName: 'S',
      rollTotal: 5, armor: 0, amount: 5, at: 1,
    }
    expect(checkEncounterHit(h)).toEqual(h)
  })

  it('reject bad data and a condition outside the list', () => {
    expect(checkEncounterMonster(null)).toBeNull()
    expect(checkEncounterMonster({ ...mon(), hp: 5 })).toBeNull()
    expect(checkEncounterMonster({ ...mon(), hp: -1 })).toBeNull()
    expect(checkEncounterMonster({ ...mon(), hp: 1.5 })).toBeNull()
    expect(checkEncounterMonster({ ...mon(), conditions: ['sleepy'] })).toBeNull()
    expect(checkEncounterMonster({ ...mon(), name: 3 })).toBeNull()
    expect(checkEncounterState({ ...emptyEncounter('g'), sortMode: 'x' })).toBeNull()
    expect(checkEncounterState({ ...emptyEncounter('g'), manualOrder: [1] })).toBeNull()
    expect(checkEncounterState({ ...emptyEncounter('g'), counters: { a: 'b' } })).toBeNull()
    expect(checkEncounterHit({ id: 'h' })).toBeNull()
    expect(checkEncounterHit({ id: 'h', rollId: 'r', target: { kind: 'npc', id: 'c', name: 'N' }, sourceName: 'S', rollTotal: 1, armor: 0, amount: 1, at: 1 })).toBeNull()
  })
})
