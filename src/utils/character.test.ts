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
  it.each([
    [10, 15, 11],
    [10, 16, 12],
    [10, 8, 9],
  ])('base %i + CON %i → maxHp %i', (base, con, expected) => {
    expect(calcMaxHp(base, con)).toBe(expected)
  })
})

describe('calcMaxLoad', () => {
  it.each([
    [12, 16, 14],
    [12, 9, 12],
    [12, 6, 11],
  ])('base %i + STR %i → maxLoad %i', (base, str, expected) => {
    expect(calcMaxLoad(base, str)).toBe(expected)
  })
})
