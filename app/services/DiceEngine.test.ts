import { describe, it, expect } from 'vitest'
import { rollNotation } from './DiceEngine'

function repeat(n: number, fn: (i: number) => void) {
  for (let i = 0; i < n; i++) fn(i)
}

describe('DiceEngine.rollNotation', () => {
  it('2d6 — two d6, total = sum', () => {
    repeat(50, () => {
      const { dice, total } = rollNotation('2d6')
      expect(dice).toHaveLength(2)
      expect(dice.every(d => d.sides === 6)).toBe(true)
      expect(dice.every(d => d.value >= 1 && d.value <= 6)).toBe(true)
      expect(total).toBe(dice[0].value + dice[1].value)
    })
  })

  it('1d6 — a single die', () => {
    const { dice, total } = rollNotation('1d6')
    expect(dice).toHaveLength(1)
    expect(dice[0].sides).toBe(6)
    expect(total).toBe(dice[0].value)
  })

  it('d6 — no prefix is treated as 1d6', () => {
    const { dice } = rollNotation('d6')
    expect(dice).toHaveLength(1)
    expect(dice[0].sides).toBe(6)
  })

  it('1d6+2d4 — two groups of different die sizes, total excludes the modifier', () => {
    repeat(50, () => {
      const { dice, total } = rollNotation('1d6+2d4')
      expect(dice).toHaveLength(3)
      const d6s = dice.filter(d => d.sides === 6)
      const d4s = dice.filter(d => d.sides === 4)
      expect(d6s).toHaveLength(1)
      expect(d4s).toHaveLength(2)
      expect(d6s[0].value).toBeGreaterThanOrEqual(1)
      expect(d6s[0].value).toBeLessThanOrEqual(6)
      d4s.forEach(d => {
        expect(d.value).toBeGreaterThanOrEqual(1)
        expect(d.value).toBeLessThanOrEqual(4)
      })
      expect(total).toBe(dice.reduce((s, d) => s + d.value, 0))
    })
  })

  it('2d6+3 — the modifier is NOT part of total (total = dice sum only)', () => {
    repeat(50, () => {
      const { dice, total } = rollNotation('2d6+3')
      expect(dice).toHaveLength(2)
      const sum = dice[0].value + dice[1].value
      expect(total).toBe(sum)
      expect(total).toBeGreaterThanOrEqual(2)
      expect(total).toBeLessThanOrEqual(12)
    })
  })

  it('2d6-1 — a negative modifier is ignored as well', () => {
    const { dice, total } = rollNotation('2d6-1')
    expect(dice).toHaveLength(2)
    expect(total).toBe(dice[0].value + dice[1].value)
  })

  it('d20 — d20 is supported', () => {
    const { dice } = rollNotation('d20')
    expect(dice[0].sides).toBe(20)
    expect(dice[0].value).toBeGreaterThanOrEqual(1)
    expect(dice[0].value).toBeLessThanOrEqual(20)
  })

  it('4d6 — four dice', () => {
    const { dice } = rollNotation('4d6')
    expect(dice).toHaveLength(4)
    expect(dice.every(d => d.sides === 6)).toBe(true)
  })

  it('throws on an unsupported die size', () => {
    expect(() => rollNotation('1d7')).toThrow(/unsupported die size/)
  })

  it('throws on empty notation', () => {
    expect(() => rollNotation('5')).toThrow(/no dice terms/)
  })

  it('preserves order: dice[i] comes from the i-th dice group of the notation', () => {
    repeat(20, () => {
      const { dice } = rollNotation('1d20+2d4+1d6')
      expect(dice).toHaveLength(4)
      expect(dice[0].sides).toBe(20)
      expect(dice[1].sides).toBe(4)
      expect(dice[2].sides).toBe(4)
      expect(dice[3].sides).toBe(6)
    })
  })
})
