import { describe, it, expect } from 'vitest'
import { charactersInScope, eventInScope, eventFilter } from './scope'
import { makeCharacter } from '@/test/fixtures'
import type { CharacterMeta, Scope } from '@/types/game'

const a = makeCharacter({ id: 'a' })
const b = makeCharacter({ id: 'b' })
const c = makeCharacter({ id: 'c' })
const d = makeCharacter({ id: 'd' })
const meta: Record<string, CharacterMeta> = {
  a: { owner: 'me', game: '' },
  b: { owner: 'me', game: 'G' },
  c: { owner: 'other', game: 'G' },
  d: { owner: 'other', game: 'H' },
}
const list = [a, b, c, d]

const home: Scope = { kind: 'home' }
const solo: Scope = { kind: 'solo' }
const game: Scope = { kind: 'game', gameId: 'G' }

describe('charactersInScope', () => {
  it('game: characters of that game', () => {
    expect(charactersInScope(list, meta, game, 'me')).toEqual([b, c])
  })

  it('solo and home: my free characters', () => {
    expect(charactersInScope(list, meta, solo, 'me')).toEqual([a])
    expect(charactersInScope(list, meta, home, 'me')).toEqual([a])
  })

  it('ignores characters without meta and returns nothing without a user', () => {
    expect(charactersInScope([a, makeCharacter({ id: 'z' })], meta, solo, 'me')).toEqual([a])
    expect(charactersInScope(list, meta, solo, null)).toEqual([])
  })
})

describe('eventInScope', () => {
  it('matches by scope', () => {
    expect(eventInScope({ character: 'b', game: 'G' }, game)).toBe(true)
    expect(eventInScope({ character: 'd', game: 'H' }, game)).toBe(false)
    expect(eventInScope({ character: 'a', game: '' }, solo)).toBe(true)
    expect(eventInScope({ character: 'b', game: 'G' }, solo)).toBe(false)
    expect(eventInScope({ character: 'a', game: '' }, home)).toBe(false)
  })
})

describe('eventFilter', () => {
  it('builds the filter string', () => {
    expect(eventFilter(game)).toBe('game = "G"')
    expect(eventFilter(solo)).toBe('game = ""')
    expect(eventFilter(home)).toBeNull()
  })
})
