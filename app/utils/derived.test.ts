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
  it('empty inventory — 0', () => {
    expect(totalArmor(makeCharacter())).toBe(0)
  })
  it('light armor — 1', () => {
    expect(totalArmor(makeCharacter({ inventory: [makeArmor('light')] }))).toBe(1)
  })
  it('full armor outweighs light — 2', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('light'), makeArmor('full')] })),
    ).toBe(2)
  })
  it('shield — +1', () => {
    expect(totalArmor(makeCharacter({ inventory: [makeShield()] }))).toBe(1)
  })
  it('light + shield — 2', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('light'), makeShield()] })),
    ).toBe(2)
  })
  it('toughness adds +1 on top', () => {
    expect(
      totalArmor(
        makeCharacter({
          inventory: [makeArmor('full'), makeShield()],
          abilityIds: ['toughness'],
        }),
      ),
    ).toBe(4)
  })
  it('toughness without armor — 1', () => {
    expect(totalArmor(makeCharacter({ abilityIds: ['toughness'] }))).toBe(1)
  })
  it('ignores armor that is not equipped', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeArmor('full', { equipped: false })] })),
    ).toBe(0)
  })
  it('ignores a shield that is not equipped', () => {
    expect(
      totalArmor(makeCharacter({ inventory: [makeShield({ equipped: false })] })),
    ).toBe(0)
  })
})

describe('damageAbilityBonus', () => {
  it('no abilities — 0', () => {
    expect(damageAbilityBonus(makeCharacter(), makeWeapon())).toBe(0)
  })
  it('skirmish + hewing on a melee weapon — 3', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['skirmish', 'hewing'] }),
        makeWeapon({ melee: true }),
      ),
    ).toBe(3)
  })
  it('skirmish + volley on a ranged weapon — 3', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['skirmish', 'volley'] }),
        makeWeapon({ melee: false }),
      ),
    ).toBe(3)
  })
  it('hewing does not apply to a ranged weapon', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['hewing'] }),
        makeWeapon({ melee: false }),
      ),
    ).toBe(0)
  })
  it('volley does not apply to a melee weapon', () => {
    expect(
      damageAbilityBonus(
        makeCharacter({ abilityIds: ['volley'] }),
        makeWeapon({ melee: true }),
      ),
    ).toBe(0)
  })
  it('non-weapon descriptor — the scoped bonus does not apply', () => {
    expect(
      damageAbilityBonus(makeCharacter({ abilityIds: ['hewing'] }), makeArmor('light')),
    ).toBe(0)
  })
  it('weapon without an explicit melee flag — the scoped bonus does not apply', () => {
    const weapon = makeWeapon({ melee: true })
    // Simulates legacy/synced data predating the melee flag: a weapon descriptor
    // with no melee key at all, not representable through the current type.
    weapon.descriptor = { kind: 'weapon' } as unknown as typeof weapon.descriptor
    expect(damageAbilityBonus(makeCharacter({ abilityIds: ['hewing'] }), weapon)).toBe(0)
  })
})

describe('damageBreakdownLines', () => {
  it('no damage — empty', () => {
    expect(damageBreakdownLines(makeCharacter(), makeWeapon({ damage: undefined }))).toEqual([])
  })
  it('lines come out in the right order', () => {
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
  it('ranged weapon + volley — volley is listed, hewing is not', () => {
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
  it('empty', () => {
    expect(armorBreakdownLines(makeCharacter())).toEqual({ lines: [], note: undefined })
  })
  it('full + shield + toughness', () => {
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
  it('skirmish adds a note', () => {
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
  it('level 1 — 1000', () => {
    expect(xpToNextLevel(makeCharacter({ level: 1, xp: 0 }))).toBe(1000)
  })
  it('partial progress', () => {
    expect(xpToNextLevel(makeCharacter({ level: 2, xp: 2000 }))).toBe(1000)
  })
  it('level 10 — null', () => {
    expect(xpToNextLevel(makeCharacter({ level: 10, xp: 100000 }))).toBeNull()
  })
})

describe('xpProgressPercent', () => {
  it('start of a level — 0', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 0 }))).toBe(0)
  })
  it('start of a mid level — 0 (counted from current, not from zero)', () => {
    // XP_THRESHOLDS[3] = 3000; exactly at the level-3 threshold, progress towards 4 is 0
    expect(xpProgressPercent(makeCharacter({ level: 3, xp: 3000 }))).toBe(0)
  })
  it('halfway from level 1 to 2', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 500 }))).toBe(50)
  })
  it('xp exactly at the next threshold — 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 1000 }))).toBe(100)
  })
  it('xp above the threshold — clamped to 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 1, xp: 9999 }))).toBe(100)
  })
  it('level 10 — 100', () => {
    expect(xpProgressPercent(makeCharacter({ level: 10, xp: 0 }))).toBe(100)
  })
})

describe('isReadyToLevelUp', () => {
  it('xp below the threshold — no', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 1, xp: 999 }))).toBe(false)
  })
  it('xp at the threshold — yes', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 1, xp: 1000 }))).toBe(true)
  })
  it('level 10 — never', () => {
    expect(isReadyToLevelUp(makeCharacter({ level: 10, xp: 999999 }))).toBe(false)
  })
})

describe('isQuicksilverOverdose', () => {
  it('count < level — no', () => {
    expect(
      isQuicksilverOverdose(makeCharacter({ level: 3, quicksilverCount: 2 })),
    ).toBe(false)
  })
  it('count === level — yes (boundary)', () => {
    expect(
      isQuicksilverOverdose(makeCharacter({ level: 3, quicksilverCount: 3 })),
    ).toBe(true)
  })
  it('quicksilverCount undefined — no', () => {
    expect(isQuicksilverOverdose(makeCharacter({ level: 3 }))).toBe(false)
  })
})

describe('hitDiceCount', () => {
  it('CON 0 → 1', () => expect(hitDiceCount(0)).toBe(1))
  it('CON 2 → 3', () => expect(hitDiceCount(2)).toBe(3))
  it('negative CON → 1', () => expect(hitDiceCount(-1)).toBe(1))
})

describe('rollHitDice', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Math.random: 0 → 1, 1/6 → 2, 2/6 → 3, 3/6 → 4, 4/6 → 5, 5/6 → 6 */
  function mockRolls(values: number[]) {
    // for rollD6: 1 + floor(random*6) = v ⇒ random = (v - 1) / 6
    const randoms = values.map(v => (v - 1) / 6)
    const spy = vi.spyOn(Math, 'random')
    randoms.forEach(r => spy.mockReturnValueOnce(r))
    return spy
  }

  it('sorts rolls in descending order', () => {
    mockRolls([2, 5, 3])
    const { rolls } = rollHitDice(3, 2)
    expect(rolls).toEqual([5, 3, 2])
  })
  it('kept = the top `level` rolls', () => {
    mockRolls([2, 5, 3, 6])
    const { kept } = rollHitDice(4, 2)
    expect(kept).toEqual([6, 5])
  })
  it('total = sum of kept', () => {
    mockRolls([1, 4, 3])
    const { kept, total } = rollHitDice(3, 2)
    expect(kept).toEqual([4, 3])
    expect(total).toBe(7)
  })
  it('numDice < level — kept = every roll', () => {
    mockRolls([3, 5])
    const { rolls, kept, total } = rollHitDice(2, 5)
    expect(rolls).toEqual([5, 3])
    expect(kept).toEqual([5, 3])
    expect(total).toBe(8)
  })
  it('level = 0 — kept is empty, total = 0', () => {
    mockRolls([4, 6])
    const { kept, total } = rollHitDice(2, 0)
    expect(kept).toEqual([])
    expect(total).toBe(0)
  })
  it('numDice = 0 — everything empty', () => {
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
  it('truncates at the first space', () => expect(parseDamageNotation('2d6 (...)')).toBe('2d6'))
  it('truncates at the first parenthesis', () => expect(parseDamageNotation('d6+2(meta)')).toBe('1d6+2'))
  it('uppercase D — matches, but is lowercased', () =>
    expect(parseDamageNotation('D6')).toBe('1d6'))
  it('empty string — returns empty', () =>
    expect(parseDamageNotation('')).toBe(''))
  it('a string without "d" is returned as is (current behaviour)', () =>
    expect(parseDamageNotation('5')).toBe('5'))
})

describe('sturdinessBonus', () => {
  it('without sturdy — 0', () => expect(sturdinessBonus([])).toBe(0))
  it('with sturdy — 6', () => expect(sturdinessBonus(['sturdy'])).toBe(6))
})

describe('hpBreakdownLines', () => {
  it('empty / undefined', () => {
    expect(hpBreakdownLines(undefined)).toEqual([])
    expect(hpBreakdownLines([])).toEqual([])
  })
  it('dice source', () => {
    expect(hpBreakdownLines([{ level: 1, roll: 4, source: 'dice' }])).toEqual([
      { value: '4', label: { key: 'derived.hpRoll', params: { level: 1 } } },
    ])
  })
  it('sturdy source', () => {
    expect(hpBreakdownLines([{ level: 1, roll: 0, source: 'sturdy' }])).toEqual([
      { value: '+6', label: { key: 'content.abilities.sturdy.name' } },
    ])
  })
  it('mixed sources across levels — order is preserved', () => {
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
