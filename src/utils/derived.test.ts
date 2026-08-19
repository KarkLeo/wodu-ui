import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  totalArmor,
  damageAbilityBonus,
  damageBreakdownLines,
  armorBreakdownLines,
  xpToNextLevel,
  xpProgressPercent,
  isReadyToLevelUp,
  isQuicksilverOverdose,
  hitDiceCount,
  rollHitDice,
  statBonusFrom2d6,
  parseDamageNotation,
  sturdinessBonus,
  hpBreakdownLines,
} from './derived'
import {
  makeCharacter,
  makeWeapon,
  makeArmor,
  makeShield,
} from '@/test/fixtures'

describe('totalArmor', () => {
  it('пустой инвентарь — 0', () => {
    expect(totalArmor(makeCharacter())).toBe(0)
  })
  it('лёгкий доспех — 1', () => {
    expect(totalArmor(makeCharacter({ inventory: [makeArmor('light')] }))).toBe(1)
  })
  it('полный доспех перевешивает лёгкий — 2', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('light'), makeArmor('full')] })),
    ).toBe(2)
  })
  it('щит — +1', () => {
    expect(totalArmor(makeCharacter({ inventory: [makeShield()] }))).toBe(1)
  })
  it('лёгкий + щит — 2', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('light'), makeShield()] })),
    ).toBe(2)
  })
  it('toughness даёт +1 поверх', () => {
    expect(
      totalArmor(
        makeCharacter({
          inventory: [makeArmor('full'), makeShield()],
          abilityIds: ['toughness'],
        }),
      ),
    ).toBe(4)
  })
  it('toughness без доспеха — 1', () => {
    expect(totalArmor(makeCharacter({ abilityIds: ['toughness'] }))).toBe(1)
  })
  it('не считает не-equipped доспех', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('full', { equipped: false })] })),
    ).toBe(0)
  })
  it('не считает не-equipped щит', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeShield({ equipped: false })] })),
    ).toBe(0)
  })
})

describe('damageAbilityBonus', () => {
  it('без способностей — 0', () => {
    expect(damageAbilityBonus(makeCharacter(), makeWeapon())).toBe(0)
  })
  it('skirmish + hewing для ближнего — 3', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['skirmish', 'hewing'] }),
        makeWeapon({ melee: true }),
      ),
    ).toBe(3)
  })
  it('skirmish + volley для дальнего — 3', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['skirmish', 'volley'] }),
        makeWeapon({ melee: false }),
      ),
    ).toBe(3)
  })
  it('hewing не применяется к ranged-weapon', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['hewing'] }),
        makeWeapon({ melee: false }),
      ),
    ).toBe(0)
  })
  it('volley не применяется к melee-weapon', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['volley'] }),
        makeWeapon({ melee: true }),
      ),
    ).toBe(0)
  })
})

describe('damageBreakdownLines', () => {
  it('без damage — пусто', () => {
    expect(damageBreakdownLines(makeCharacter(), makeWeapon({ damage: undefined }))).toEqual([])
  })
  it('строки в правильном порядке', () => {
    const lines = damageBreakdownLines(
      makeCharacter({ abilityIds: ['skirmish', 'hewing'], damageBonusDice: 1 }),
      makeWeapon({ melee: true, damage: 'd6+1' }),
    )
    expect(lines).toEqual([
      { value: 'd6+1', label: { key: 'derived.weapon' } },
      { value: '+1', label: { key: 'content.abilities.skirmish.name' } },
      { value: '+2', label: { key: 'content.abilities.hewing.name' } },
      { value: '+1d6', label: { key: 'derived.levelBonus' } },
    ])
  })
  it('ranged weapon + volley — Залп присутствует, Рубка отсутствует', () => {
    const lines = damageBreakdownLines(
      makeCharacter({ abilityIds: ['volley', 'hewing'] }),
      makeWeapon({ melee: false, damage: 'd6' }),
    )
    expect(lines).toEqual([
      { value: 'd6', label: { key: 'derived.weapon' } },
      { value: '+2', label: { key: 'content.abilities.volley.name' } },
    ])
  })
  it('lists the weapon, ability bonuses and effects as label refs', () => {
    const lines = damageBreakdownLines(
      makeCharacter({ abilityIds: ['hewing'], damageBonusDice: 1, damageMod: 2 }),
      makeWeapon({ melee: true, damage: '1d6' }),
    )
    expect(lines).toEqual([
      { value: '1d6', label: { key: 'derived.weapon' } },
      { value: '+2', label: { key: 'content.abilities.hewing.name' } },
      { value: '+1d6', label: { key: 'derived.levelBonus' } },
      { value: '+2', label: { key: 'derived.effects' } },
    ])
  })
})

describe('armorBreakdownLines', () => {
  it('пусто', () => {
    expect(armorBreakdownLines(makeCharacter())).toEqual({ lines: [], note: undefined })
  })
  it('полный + щит + toughness', () => {
    const result = armorBreakdownLines(
      makeCharacter({
        inventory: [makeArmor('full'), makeShield()],
        abilityIds: ['toughness'],
      }),
    )
    expect(result.lines).toEqual([
      { value: '2', label: { key: 'derived.armorFull' } },
      { value: '+1', label: { key: 'derived.shield' } },
      { value: '+1', label: { key: 'content.abilities.toughness.name' } },
    ])
    expect(result.note).toBeUndefined()
  })
  it('skirmish добавляет note', () => {
    const result = armorBreakdownLines(
      makeCharacter({ inventory: [makeArmor('full')], abilityIds: ['skirmish'] }),
    )
    expect(result.note).toEqual({
      key: 'derived.armorLighterNote',
      params: { ability: { $key: 'content.abilities.skirmish.name' } },
    })
  })
  it('describes equipped armor and the lighter-armor note', () => {
    const char = makeCharacter({
      abilityIds: ['skirmish'],
      inventory: [
        { id: 'a', name: '', descriptor: { kind: 'armor', class: 'full' }, equipped: true },
        { id: 's', name: '', descriptor: { kind: 'shield' }, equipped: true },
      ],
    })
    const { lines, note } = armorBreakdownLines(char)
    expect(lines).toContainEqual({ value: '2', label: { key: 'derived.armorFull' } })
    expect(lines).toContainEqual({ value: '+1', label: { key: 'derived.shield' } })
    expect(note).toEqual({
      key: 'derived.armorLighterNote',
      params: { ability: { $key: 'content.abilities.skirmish.name' } },
    })
  })
})

describe('xpToNextLevel', () => {
  it('1 уровень — 1000', () => {
    expect(xpToNextLevel(makeCharacter({ level: 1, xp: 0 }))).toBe(1000)
  })
  it('частичный прогресс', () => {
    expect(xpToNextLevel(makeCharacter({ level: 2, xp: 2000 }))).toBe(1000)
  })
  it('10 уровень — null', () => {
    expect(xpToNextLevel(makeCharacter({ level: 10, xp: 100000 }))).toBeNull()
  })
})

describe('xpProgressPercent', () => {
  it('начало уровня — 0', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 0 }))).toBe(0)
  })
  it('начало середнего уровня — 0 (считает от current, не от нуля)', () => {
    // XP_THRESHOLDS[3] = 3000; ровно на пороге 3-го уровня прогресс к 4-му = 0
    expect(xpProgressPercent(makeCharacter({ level: 3, xp: 3000 }))).toBe(0)
  })
  it('середина 1→2 уровня', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 500 }))).toBe(50)
  })
  it('xp ровно на пороге следующего уровня — 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 1000 }))).toBe(100)
  })
  it('xp выше порога — clamp до 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 9999 }))).toBe(100)
  })
  it('10 уровень — 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 10, xp: 0 }))).toBe(100)
  })
})

describe('isReadyToLevelUp', () => {
  it('xp ниже порога — нет', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 1, xp: 999 }))).toBe(false)
  })
  it('xp на пороге — да', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 1, xp: 1000 }))).toBe(true)
  })
  it('10 уровень — никогда', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 10, xp: 999999 }))).toBe(false)
  })
})

describe('isQuicksilverOverdose', () => {
  it('count < level — нет', () => {
    expect(
      isQuicksilverOverdose(makeCharacter({ level: 3, quicksilverCount: 2 })),
    ).toBe(false)
  })
  it('count === level — да (граница)', () => {
    expect(
      isQuicksilverOverdose(makeCharacter({ level: 3, quicksilverCount: 3 })),
    ).toBe(true)
  })
  it('quicksilverCount undefined — нет', () => {
    expect(isQuicksilverOverdose(makeCharacter({ level: 3 }))).toBe(false)
  })
})

describe('hitDiceCount', () => {
  it('CON 0 → 1', () => expect(hitDiceCount(0)).toBe(1))
  it('CON 2 → 3', () => expect(hitDiceCount(2)).toBe(3))
  it('CON отрицательный → 1', () => expect(hitDiceCount(-1)).toBe(1))
})

describe('rollHitDice', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Math.random: 0 → 1, 1/6 → 2, 2/6 → 3, 3/6 → 4, 4/6 → 5, 5/6 → 6 */
  function mockRolls(values: number[]) {
    // для rollD6: 1 + floor(random*6) = v ⇒ random = (v - 1) / 6
    const randoms = values.map(v => (v - 1) / 6)
    const spy = vi.spyOn(Math, 'random')
    randoms.forEach(r => spy.mockReturnValueOnce(r))
    return spy
  }

  it('сортирует rolls по убыванию', () => {
    mockRolls([2, 5, 3])
    const { rolls } = rollHitDice(3, 2)
    expect(rolls).toEqual([5, 3, 2])
  })
  it('kept = top `level` значений', () => {
    mockRolls([2, 5, 3, 6])
    const { kept } = rollHitDice(4, 2)
    expect(kept).toEqual([6, 5])
  })
  it('total = сумма kept', () => {
    mockRolls([1, 4, 3])
    const { kept, total } = rollHitDice(3, 2)
    expect(kept).toEqual([4, 3])
    expect(total).toBe(7)
  })
  it('numDice < level — kept = все rolls', () => {
    mockRolls([3, 5])
    const { rolls, kept, total } = rollHitDice(2, 5)
    expect(rolls).toEqual([5, 3])
    expect(kept).toEqual([5, 3])
    expect(total).toBe(8)
  })
  it('level = 0 — kept пустой, total = 0', () => {
    mockRolls([4, 6])
    const { kept, total } = rollHitDice(2, 0)
    expect(kept).toEqual([])
    expect(total).toBe(0)
  })
  it('numDice = 0 — всё пусто', () => {
    const { rolls, kept, total } = rollHitDice(0, 3)
    expect(rolls).toEqual([])
    expect(kept).toEqual([])
    expect(total).toBe(0)
  })
})

describe('statBonusFrom2d6', () => {
  it.each([
    [2, 0],
    [6, 0],
    [7, 1],
    [9, 1],
    [10, 2],
    [11, 2],
    [12, 3],
  ])('roll %i → %i', (roll, bonus) => {
    expect(statBonusFrom2d6(roll)).toBe(bonus)
  })
})

describe('parseDamageNotation', () => {
  it('d6 → 1d6', () => expect(parseDamageNotation('d6')).toBe('1d6'))
  it('1d8+1 → 1d8+1', () => expect(parseDamageNotation('1d8+1')).toBe('1d8+1'))
  it('обрезает после пробела', () => expect(parseDamageNotation('2d6 (...)')).toBe('2d6'))
  it('обрезает после скобки', () => expect(parseDamageNotation('d6+2(meta)')).toBe('1d6+2'))
  it('заглавная D — матчится, но заменяется на нижний регистр', () =>
    expect(parseDamageNotation('D6')).toBe('1d6'))
  it('пустая строка — возвращает пустую', () =>
    expect(parseDamageNotation('')).toBe(''))
  it('строка без "d" возвращается как есть (текущее поведение)', () =>
    expect(parseDamageNotation('5')).toBe('5'))
})

describe('sturdinessBonus', () => {
  it('без sturdy — 0', () => expect(sturdinessBonus([])).toBe(0))
  it('со sturdy — 6', () => expect(sturdinessBonus(['sturdy'])).toBe(6))
})

describe('hpBreakdownLines', () => {
  it('пусто/undefined', () => {
    expect(hpBreakdownLines(undefined)).toEqual([])
    expect(hpBreakdownLines([])).toEqual([])
  })
  it('dice-источник', () => {
    expect(hpBreakdownLines([{ level: 1, roll: 4, source: 'dice' }])).toEqual([
      { value: '4', label: { key: 'derived.hpRoll', params: { level: 1 } } },
    ])
  })
  it('sturdy-источник', () => {
    expect(hpBreakdownLines([{ level: 1, roll: 0, source: 'sturdy' }])).toEqual([
      { value: '+6', label: { key: 'content.abilities.sturdy.name' } },
    ])
  })
  it('смесь источников по уровням — порядок сохраняется', () => {
    expect(
      hpBreakdownLines([
        { level: 1, roll: 4, source: 'dice' },
        { level: 2, roll: 0, source: 'sturdy' },
        { level: 2, roll: 5, source: 'dice' },
        { level: 3, roll: 6, source: 'dice' },
      ]),
    ).toEqual([
      { value: '4', label: { key: 'derived.hpRoll', params: { level: 1 } } },
      { value: '+6', label: { key: 'content.abilities.sturdy.name' } },
      { value: '5', label: { key: 'derived.hpRoll', params: { level: 2 } } },
      { value: '6', label: { key: 'derived.hpRoll', params: { level: 3 } } },
    ])
  })
})
