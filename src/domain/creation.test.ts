import { describe, it, expect } from 'vitest'
import { setStatRollsBatch } from './creation'
import { makeCharacter } from '@/test/fixtures'

describe('setStatRollsBatch', () => {
  it('применяет все шесть статов одним вызовом', () => {
    const char = makeCharacter()
    const next = setStatRollsBatch(char, [
      { key: 'str', roll: 10, bonus: 2 },
      { key: 'dex', roll: 9,  bonus: 2 },
      { key: 'con', roll: 8,  bonus: 1 },
      { key: 'int', roll: 7,  bonus: 1 },
      { key: 'wis', roll: 12, bonus: 3 },
      { key: 'cha', roll: 4,  bonus: 0 },
    ])
    expect(next.statRolls).toEqual({ str: 10, dex: 9, con: 8, int: 7, wis: 12, cha: 4 })
    expect(next.stats).toEqual({ str: 2, dex: 2, con: 1, int: 1, wis: 3, cha: 0 })
    expect(next).not.toBe(char)
  })

  it('частичный батч обновляет только указанные ключи', () => {
    const char = makeCharacter({
      statRolls: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
      stats:     { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    })
    const next = setStatRollsBatch(char, [
      { key: 'str', roll: 11, bonus: 2 },
      { key: 'cha', roll: 12, bonus: 3 },
    ])
    expect(next.statRolls.str).toBe(11)
    expect(next.statRolls.cha).toBe(12)
    expect(next.statRolls.dex).toBe(5)
    expect(next.statRolls.con).toBe(5)
    expect(next.statRolls.int).toBe(5)
    expect(next.statRolls.wis).toBe(5)
    expect(next.stats.str).toBe(2)
    expect(next.stats.cha).toBe(3)
    expect(next.stats.dex).toBe(0)
  })

  it('пустой батч возвращает новый объект без изменений', () => {
    const char = makeCharacter()
    const next = setStatRollsBatch(char, [])
    expect(next.statRolls).toEqual(char.statRolls)
    expect(next.stats).toEqual(char.stats)
  })
})
