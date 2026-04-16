import { describe, it, expect } from 'vitest'
import { statModifier, xpThreshold, calcMaxHp, calcMaxLoad } from './character'

describe('statModifier', () => {
  it.each([
    [1, -3], [3, -3],
    [4, -2], [5, -2],
    [6, -1], [8, -1],
    [9, 0],  [11, 0],
    [12, 1], [15, 1],
    [16, 2], [17, 2],
    [18, 3],
  ])('stat %i → modifier %i', (stat, mod) => {
    expect(statModifier(stat)).toBe(mod)
  })
})

describe('xpThreshold', () => {
  it.each([
    [1, 8], [3, 10], [9, 16],
  ])('level %i → threshold %i', (level, threshold) => {
    expect(xpThreshold(level)).toBe(threshold)
  })
})

describe('calcMaxHp', () => {
  it('Fighter base 10 + CON modifier', () => {
    expect(calcMaxHp(10, 15)).toBe(11) // CON 15 → +1
    expect(calcMaxHp(10, 16)).toBe(12) // CON 16 → +2
    expect(calcMaxHp(10, 8)).toBe(9)   // CON 8  → -1
  })
})

describe('calcMaxLoad', () => {
  it('Fighter base 12 + STR modifier', () => {
    expect(calcMaxLoad(12, 16)).toBe(14) // STR 16 → +2
    expect(calcMaxLoad(12, 9)).toBe(12)  // STR 9  → 0
    expect(calcMaxLoad(12, 6)).toBe(11)  // STR 6  → -1
  })
})
