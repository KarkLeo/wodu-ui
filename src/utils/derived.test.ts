import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  totalArmor,
  armorTypeLabel,
  damageFormula,
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

describe('armorTypeLabel', () => {
  it('пусто', () => {
    expect(armorTypeLabel(makeCharacter())).toBe('')
  })
  it('лёгкий', () => {
    expect(armorTypeLabel(makeCharacter({ inventory: [makeArmor('light')] }))).toBe('лёгкий')
  })
  it('полный', () => {
    expect(armorTypeLabel(makeCharacter({ inventory: [makeArmor('full')] }))).toBe('полный')
  })
  it('только щит', () => {
    expect(armorTypeLabel(makeCharacter({ inventory: [makeShield()] }))).toBe('щит')
  })
  it('лёгкий + щит', () => {
    expect(
      armorTypeLabel(makeCharacter({ inventory: [makeArmor('light'), makeShield()] })),
    ).toBe('лёгкий + щит')
  })
  it('полный + щит', () => {
    expect(
      armorTypeLabel(makeCharacter({ inventory: [makeArmor('full'), makeShield()] })),
    ).toBe('полный + щит')
  })
  it('не-equipped щит не попадает в лейбл', () => {
    expect(
      armorTypeLabel(makeCharacter({ inventory: [makeShield({ equipped: false })] })),
    ).toBe('')
  })
})

describe('damageFormula', () => {
  it('без damage — прочерк', () => {
    expect(damageFormula(makeCharacter(), makeWeapon({ damage: undefined }))).toBe('—')
  })
  it('melee: undefined — ни hewing, ни volley не применяются', () => {
    const weapon = makeWeapon()
    // @ts-expect-error — специально мутируем descriptor для проверки ветви
    weapon.descriptor = { kind: 'weapon' }
    expect(
      damageFormula(
        makeCharacter({ abilityIds: ['hewing', 'volley'] }),
        weapon,
      ),
    ).toBe('d6')
  })
  it('базовая формула', () => {
    expect(damageFormula(makeCharacter(), makeWeapon())).toBe('d6')
  })
  it('skirmish добавляет +1 к манёвренности', () => {
    expect(
      damageFormula(makeCharacter({ abilityIds: ['skirmish'] }), makeWeapon()),
    ).toBe('d6 (+1 Манёвр.)')
  })
  it('hewing работает только в ближнем бою', () => {
    expect(
      damageFormula(makeCharacter({ abilityIds: ['hewing'] }), makeWeapon({ melee: true })),
    ).toBe('d6 (+2 Рубка)')
    expect(
      damageFormula(makeCharacter({ abilityIds: ['hewing'] }), makeWeapon({ melee: false })),
    ).toBe('d6')
  })
  it('volley работает только в дальнем бою', () => {
    expect(
      damageFormula(makeCharacter({ abilityIds: ['volley'] }), makeWeapon({ melee: false })),
    ).toBe('d6 (+2 Залп)')
    expect(
      damageFormula(makeCharacter({ abilityIds: ['volley'] }), makeWeapon({ melee: true })),
    ).toBe('d6')
  })
  it('damageBonusDice добавляет +Nd6', () => {
    expect(damageFormula(makeCharacter({ damageBonusDice: 2 }), makeWeapon())).toBe('d6 +2d6')
  })
  it('damageBonusDice=0 — без "+0d6"', () => {
    expect(damageFormula(makeCharacter({ damageBonusDice: 0 }), makeWeapon())).toBe('d6')
  })
  it('всё вместе', () => {
    expect(
      damageFormula(
        makeCharacter({ abilityIds: ['skirmish', 'hewing'], damageBonusDice: 1 }),
        makeWeapon({ melee: true }),
      ),
    ).toBe('d6 +1d6 (+1 Манёвр., +2 Рубка)')
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
      { value: 'd6+1', label: 'оружие' },
      { value: '+1', label: 'Манёвренность' },
      { value: '+2', label: 'Рубка' },
      { value: '+1d6', label: 'бонус уровня' },
    ])
  })
  it('ranged weapon + volley — Залп присутствует, Рубка отсутствует', () => {
    const lines = damageBreakdownLines(
      makeCharacter({ abilityIds: ['volley', 'hewing'] }),
      makeWeapon({ melee: false, damage: 'd6' }),
    )
    expect(lines).toEqual([
      { value: 'd6', label: 'оружие' },
      { value: '+2', label: 'Залп' },
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
      { value: '2', label: 'полный доспех' },
      { value: '+1', label: 'щит' },
      { value: '+1', label: 'Прочность' },
    ])
    expect(result.note).toBeUndefined()
  })
  it('skirmish добавляет note', () => {
    const result = armorBreakdownLines(
      makeCharacter({ inventory: [makeArmor('full')], abilityIds: ['skirmish'] }),
    )
    expect(result.note).toBe('доспех считается лёгким (Манёвренность)')
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
      { value: '4', label: 'ур. 1, бросок к6' },
    ])
  })
  it('sturdy-источник', () => {
    expect(hpBreakdownLines([{ level: 1, roll: 0, source: 'sturdy' }])).toEqual([
      { value: '+6', label: 'Стойкость' },
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
      { value: '4', label: 'ур. 1, бросок к6' },
      { value: '+6', label: 'Стойкость' },
      { value: '5', label: 'ур. 2, бросок к6' },
      { value: '6', label: 'ур. 3, бросок к6' },
    ])
  })
})
