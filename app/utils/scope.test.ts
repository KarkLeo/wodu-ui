import { describe, it, expect } from 'vitest'
import {
  charactersInScope,
  eventInScope,
  eventFilter,
  freeIfGameUnknown,
  homeLocation,
  panelHomeLocation,
  levelUpLocation,
  newCharacterLocation,
  partyLocation,
  scopeForRoute,
  tableLocation,
} from './scope'
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

describe('scopeForRoute', () => {
  it('game routes open that game', () => {
    for (const name of ['game', 'game-party', 'game-character-new', 'game-settings', 'game-monsters', 'game-items']) {
      expect(scopeForRoute(name, 'G', true)).toEqual({ kind: 'game', gameId: 'G' })
    }
  })

  it('the party route online is the solo table', () => {
    expect(scopeForRoute('party', undefined, true)).toEqual({ kind: 'solo' })
  })

  it('everything else is home', () => {
    expect(scopeForRoute('games', undefined, true)).toEqual({ kind: 'home' })
    expect(scopeForRoute('join', undefined, true)).toEqual({ kind: 'home' })
    expect(scopeForRoute(undefined, undefined, true)).toEqual({ kind: 'home' })
    expect(scopeForRoute('game', '', true)).toEqual({ kind: 'home' })
  })

  it('level-up takes the table of its character\'s game', () => {
    expect(scopeForRoute('level-up', undefined, true, 'G')).toEqual({ kind: 'game', gameId: 'G' })
  })

  it('level-up of a free character is the solo table', () => {
    expect(scopeForRoute('level-up', undefined, true, '')).toEqual({ kind: 'solo' })
    expect(scopeForRoute('level-up', undefined, true)).toEqual({ kind: 'solo' })
  })

  it('a character game only matters on the level-up route', () => {
    expect(scopeForRoute('games', undefined, true, 'G')).toEqual({ kind: 'home' })
    expect(scopeForRoute('party', undefined, true, 'G')).toEqual({ kind: 'solo' })
  })

  it('offline mode stays home', () => {
    expect(scopeForRoute('game', 'G', false)).toEqual({ kind: 'home' })
    expect(scopeForRoute('party', undefined, false)).toEqual({ kind: 'home' })
    expect(scopeForRoute('level-up', undefined, false, 'G')).toEqual({ kind: 'home' })
  })
})

describe('freeIfGameUnknown', () => {
  const known = (id: string) => id === 'G'

  it('keeps a known game and a free character as they are', () => {
    const inG = { owner: 'me', game: 'G' }
    const free = { owner: 'me', game: '' }
    expect(freeIfGameUnknown(inG, known)).toBe(inG)
    expect(freeIfGameUnknown(free, known)).toBe(free)
    expect(freeIfGameUnknown(undefined, known)).toBeUndefined()
  })

  it('treats a game the player no longer knows as no game', () => {
    expect(freeIfGameUnknown({ owner: 'me', game: 'H' }, known)).toEqual({ owner: 'me', game: '' })
  })
})

describe('homeLocation', () => {
  it('online goes to the games, offline to the offline table', () => {
    expect(homeLocation(false)).toEqual({ name: 'games' })
    expect(homeLocation(true)).toEqual({ name: 'offline' })
  })
})

describe('tableLocation', () => {
  it('a game goes back to its table, the free-characters table to the characters', () => {
    expect(tableLocation(game)).toEqual({ name: 'game', params: { gameId: 'G' } })
    expect(tableLocation(solo)).toEqual({ name: 'characters' })
    expect(tableLocation(home)).toEqual({ name: 'characters' })
  })

  it('offline stays on the offline table', () => {
    expect(tableLocation(home, true)).toEqual({ name: 'offline' })
  })
})

describe('panelHomeLocation', () => {
  it('a game table goes to the games, the free-characters table to the characters', () => {
    expect(panelHomeLocation(game)).toEqual({ name: 'games' })
    expect(panelHomeLocation(solo)).toEqual({ name: 'characters' })
    expect(panelHomeLocation(home)).toEqual({ name: 'characters' })
  })

  it('the offline table goes to the landing', () => {
    expect(panelHomeLocation(home, true)).toEqual({ name: 'landing' })
  })

  it('an invite page goes to the games', () => {
    expect(panelHomeLocation(home, false, 'join')).toEqual({ name: 'games' })
  })
})

describe('partyLocation', () => {
  it('opens the sheets on the game\'s own party route', () => {
    expect(partyLocation(game, ['a', 'b'])).toEqual({ name: 'game-party', params: { gameId: 'G', ids: 'a,b' } })
  })

  it('outside a game uses the party route', () => {
    expect(partyLocation(solo, ['a'])).toEqual({ name: 'party', params: { ids: 'a' } })
    expect(partyLocation(home, ['a', 'b'])).toEqual({ name: 'party', params: { ids: 'a,b' } })
  })

  it('with no sheet left goes back to the table', () => {
    expect(partyLocation(game, [])).toEqual({ name: 'game', params: { gameId: 'G' } })
    expect(partyLocation(solo, [])).toEqual({ name: 'characters' })
  })

  it('offline opens the sheets under /offline, and with none left returns to the offline table', () => {
    expect(partyLocation(home, ['a', 'b'], true)).toEqual({ name: 'offline-party', params: { ids: 'a,b' } })
    expect(partyLocation(home, [], true)).toEqual({ name: 'offline' })
  })
})

describe('newCharacterLocation', () => {
  it('a game creates in the game, outside games the free wizard', () => {
    expect(newCharacterLocation(game)).toEqual({ name: 'game-character-new', params: { gameId: 'G' } })
    expect(newCharacterLocation(solo)).toEqual({ name: 'character-new' })
    expect(newCharacterLocation(home)).toEqual({ name: 'character-new' })
  })

  it('offline uses the offline wizard', () => {
    expect(newCharacterLocation(home, true)).toEqual({ name: 'offline-character-new' })
  })
})

describe('levelUpLocation', () => {
  it('online and offline each have their own level-up route', () => {
    expect(levelUpLocation('a')).toEqual({ name: 'level-up', params: { id: 'a' } })
    expect(levelUpLocation('a', true)).toEqual({ name: 'offline-level-up', params: { id: 'a' } })
  })
})
