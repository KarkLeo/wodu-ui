import { describe, expect, it } from 'vitest'
import { OFFLINE_KEYS, parseList } from './offlineStorage'

const isNum = (x: unknown): x is number => typeof x === 'number'

describe('parseList', () => {
  it('handles valid, partial and corrupt input', () => {
    expect(parseList(null, isNum)).toEqual({ items: [], corrupt: false })
    expect(parseList('[1,2]', isNum)).toEqual({ items: [1, 2], corrupt: false })
    expect(parseList('[1,"x",3]', isNum)).toEqual({ items: [1, 3], corrupt: false })
    expect(parseList('{bad', isNum)).toEqual({ items: [], corrupt: true })
    expect(parseList('{"a":1}', isNum)).toEqual({ items: [], corrupt: true })
  })
})

describe('OFFLINE_KEYS', () => {
  it('uses the offline namespace', () => {
    expect(Object.values(OFFLINE_KEYS).every(k => k.startsWith('wod.offline.'))).toBe(true)
  })
})
