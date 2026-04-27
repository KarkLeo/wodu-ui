import { describe, it, expect } from 'vitest'
import { rollNotation } from './DiceEngine'

function repeat(n: number, fn: (i: number) => void) {
  for (let i = 0; i < n; i++) fn(i)
}

describe('DiceEngine.rollNotation', () => {
  it('2d6 — два куба d6, total = сумма', () => {
    repeat(50, () => {
      const { dice, total } = rollNotation('2d6')
      expect(dice).toHaveLength(2)
      expect(dice.every(d => d.sides === 6)).toBe(true)
      expect(dice.every(d => d.value >= 1 && d.value <= 6)).toBe(true)
      expect(total).toBe(dice[0].value + dice[1].value)
    })
  })

  it('1d6 — один куб', () => {
    const { dice, total } = rollNotation('1d6')
    expect(dice).toHaveLength(1)
    expect(dice[0].sides).toBe(6)
    expect(total).toBe(dice[0].value)
  })

  it('d6 — без префикса трактуется как 1d6', () => {
    const { dice } = rollNotation('d6')
    expect(dice).toHaveLength(1)
    expect(dice[0].sides).toBe(6)
  })

  it('1d6+2d4 — две группы кубов разного размера, total без модификатора', () => {
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

  it('2d6+3 — модификатор НЕ входит в total (total = только сумма кубов)', () => {
    repeat(50, () => {
      const { dice, total } = rollNotation('2d6+3')
      expect(dice).toHaveLength(2)
      const sum = dice[0].value + dice[1].value
      expect(total).toBe(sum)
      expect(total).toBeGreaterThanOrEqual(2)
      expect(total).toBeLessThanOrEqual(12)
    })
  })

  it('2d6-1 — отрицательный модификатор тоже игнорируется', () => {
    const { dice, total } = rollNotation('2d6-1')
    expect(dice).toHaveLength(2)
    expect(total).toBe(dice[0].value + dice[1].value)
  })

  it('d20 — поддерживает d20', () => {
    const { dice } = rollNotation('d20')
    expect(dice[0].sides).toBe(20)
    expect(dice[0].value).toBeGreaterThanOrEqual(1)
    expect(dice[0].value).toBeLessThanOrEqual(20)
  })

  it('4d6 — четыре куба', () => {
    const { dice } = rollNotation('4d6')
    expect(dice).toHaveLength(4)
    expect(dice.every(d => d.sides === 6)).toBe(true)
  })

  it('бросает на неподдерживаемом размере куба', () => {
    expect(() => rollNotation('1d7')).toThrow(/unsupported die size/)
  })

  it('бросает на пустой нотации', () => {
    expect(() => rollNotation('5')).toThrow(/no dice terms/)
  })

  it('сохраняет порядок: dice[i] из i-й dice-группы нотации', () => {
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
