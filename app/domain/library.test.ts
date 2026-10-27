import { describe, it, expect } from 'vitest'
import { checkMonster, checkItem, normalizeDamage } from './library'

const ID = 'm-1234567890abcd'
const goblin = { id: ID, name: ' Goblin ', hp: 6, armor: 1, damage: 'D6', special: '  ', notes: 'cowardly', extra: 1 }

describe('checkMonster', () => {
  it('normalises a valid entry', () => {
    expect(checkMonster(goblin)).toEqual({
      ok: true,
      value: { id: ID, name: 'Goblin', hp: 6, armor: 1, damage: '1d6', notes: 'cowardly' },
    })
  })

  it('lists every problem', () => {
    const r = checkMonster({ id: ID, name: '   ', hp: '6', armor: -1, damage: '1d6+1d4' })
    expect(r).toEqual({
      ok: false,
      problems: expect.arrayContaining([
        { field: 'name', key: 'required' },
        { field: 'hp', key: 'notInteger' },
        { field: 'armor', key: 'outOfRange' },
        { field: 'damage', key: 'badFormula' },
      ]),
    })
  })

  it.each([[0], [1000], [6.5], [NaN]])('refuses hp %s', (hp) => {
    const r = checkMonster({ ...goblin, hp })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problems.map(p => p.field)).toContain('hp')
  })

  it('refuses a name over 80 chars', () => {
    const r = checkMonster({ ...goblin, name: 'x'.repeat(81) })
    expect(r).toEqual({ ok: false, problems: [{ field: 'name', key: 'tooLong' }] })
  })

  it.each([[null], [[]], ['goblin'], [undefined]])('refuses non-object %s', (v) => {
    expect(checkMonster(v)).toEqual({ ok: false, problems: [{ field: '*', key: 'notObject' }] })
  })
})

describe('normalizeDamage', () => {
  it.each([['d6', '1d6'], ['2D6-1', '2d6-1'], [' d6 + 1 ', '1d6+1'], ['1d6+0', '1d6'], ['d100', '1d100']])(
    '%s -> %s',
    (i, o) => {
      expect(normalizeDamage(i)).toBe(o)
    },
  )

  it.each(['d7', '1d6+1d4', 'abc', '', '6'])('%s -> null', (i) => {
    expect(normalizeDamage(i)).toBeNull()
  })
})

describe('checkItem', () => {
  const base = { id: 'i-1234567890abcd', name: 'Thing' }
  const okValue = (v: unknown) => {
    const r = checkItem(v)
    if (!r.ok) throw new Error(JSON.stringify(r.problems))
    return r.value
  }

  it('accepts every descriptor kind of the inventory', () => {
    const descriptors = [
      { kind: 'weapon', melee: true },
      { kind: 'weapon', melee: false },
      { kind: 'armor', class: 'none' },
      { kind: 'armor', class: 'light' },
      { kind: 'armor', class: 'full' },
      { kind: 'shield' },
      { kind: 'gear' },
      { kind: 'gear', consumable: true },
      { kind: 'tool' },
      { kind: 'occult' },
      { kind: 'occult', consumable: true },
      { kind: 'custom' },
      { kind: 'custom', consumable: false },
      { kind: 'custom', consumable: true },
    ]
    for (const descriptor of descriptors) {
      expect(checkItem({ ...base, descriptor }).ok).toBe(true)
    }
  })

  it('refuses a broken descriptor', () => {
    for (const descriptor of [{ kind: 'sword' }, { kind: 'armor', class: 'heavy' }, { kind: 'weapon' }]) {
      expect(checkItem({ ...base, descriptor })).toEqual({
        ok: false,
        problems: [{ field: 'descriptor', key: 'badDescriptor' }],
      })
    }
  })

  it('drops quantity on a non-consumable and keeps it on a consumable', () => {
    const armor = okValue({ ...base, descriptor: { kind: 'armor', class: 'light' }, quantity: 3 })
    expect(armor.quantity).toBeUndefined()
    const potion = okValue({ ...base, descriptor: { kind: 'gear', consumable: true }, quantity: 3 })
    expect(potion.quantity).toBe(3)
    for (const quantity of [0, 100]) {
      expect(checkItem({ ...base, descriptor: { kind: 'gear', consumable: true }, quantity })).toEqual({
        ok: false,
        problems: [{ field: 'quantity', key: 'outOfRange' }],
      })
    }
  })

  it('accepts damage on any kind and normalises it', () => {
    const oil = okValue({ ...base, descriptor: { kind: 'gear', consumable: true }, damage: 'd6+1' })
    expect(oil.damage).toBe('1d6+1')
  })

  it('refuses a negative or fractional price', () => {
    expect(checkItem({ ...base, descriptor: { kind: 'tool' }, price: -1 })).toEqual({
      ok: false,
      problems: [{ field: 'price', key: 'outOfRange' }],
    })
    expect(checkItem({ ...base, descriptor: { kind: 'tool' }, price: 2.5 })).toEqual({
      ok: false,
      problems: [{ field: 'price', key: 'notInteger' }],
    })
  })

  it('drops unknown keys and empty optional strings', () => {
    expect(okValue({ ...base, descriptor: { kind: 'tool', junk: 1 }, notes: ' ', price: 5, extra: 1 })).toEqual({
      ...base,
      descriptor: { kind: 'tool' },
      price: 5,
    })
  })
})
