import { describe, expect, it } from 'vitest'
import { gameGuard, gamePartyGuard, levelUpGuard, partyGameRedirect, partyGuard } from './routeGuards'
import { makeCharacter } from '@/test/fixtures'
import type { Character } from '@/types/character'
import type { CharacterMeta } from '@/types/game'

const active = (id: string) => makeCharacter({ id, status: 'active' })
const draft = (id: string) => makeCharacter({ id, status: 'draft' })

const chars: Record<string, Character> = { a: active('a'), b: active('b'), d: draft('d') }
const getById = (id: string): Character | undefined => chars[id]

describe('partyGuard', () => {
  it('lets a party of valid characters through', () => {
    expect(partyGuard('a', getById)).toBeUndefined()
  })

  it('drops missing ids', () => {
    expect(partyGuard('a,missing', getById)).toEqual({ name: 'party', params: { ids: 'a' } })
  })

  it('drops drafts and trims whitespace', () => {
    expect(partyGuard('a, d ,b', getById)).toEqual({ name: 'party', params: { ids: 'a,b' } })
  })

  it('redirects to the list when no id is valid', () => {
    expect(partyGuard('missing', getById)).toEqual({ name: 'character-list' })
    expect(partyGuard('', getById)).toEqual({ name: 'character-list' })
    expect(partyGuard(undefined, getById)).toEqual({ name: 'character-list' })
  })

  it('does not redirect while online data is not loaded', () => {
    expect(partyGuard('missing', getById, false)).toBeUndefined()
    expect(partyGuard('a,missing', getById, false)).toBeUndefined()
    expect(partyGuard('missing', getById, true)).toEqual({ name: 'character-list' })
  })

  it('keeps only the characters `allowed` accepts', () => {
    const onlyA = (c: Character) => c.id === 'a'
    expect(partyGuard('a', getById, true, onlyA)).toBeUndefined()
    expect(partyGuard('a,b', getById, true, onlyA)).toEqual({ name: 'party', params: { ids: 'a' } })
    expect(partyGuard('b', getById, true, onlyA)).toEqual({ name: 'character-list' })
    expect(partyGuard('b', getById, false, onlyA)).toBeUndefined()
  })
})

// a, b: game G; c: game H; f: free; g: draft in G
const gameChars: Record<string, Character> = {
  a: active('a'), b: active('b'), c: active('c'), f: active('f'), g: draft('g'),
}
const gameMeta: Record<string, CharacterMeta> = {
  a: { owner: 'me', game: 'G' },
  b: { owner: 'other', game: 'G' },
  c: { owner: 'me', game: 'H' },
  f: { owner: 'me', game: '' },
  g: { owner: 'me', game: 'G' },
}
const getGameChar = (id: string): Character | undefined => gameChars[id]
const metaOf = (id: string): CharacterMeta | undefined => gameMeta[id]

describe('gameGuard', () => {
  const isMember = (id: string) => id === 'G'

  it('lets a member in', () => {
    expect(gameGuard('G', isMember)).toBeUndefined()
  })

  it('sends a non-member home', () => {
    expect(gameGuard('H', isMember)).toEqual({ name: 'character-list' })
    expect(gameGuard('', isMember)).toEqual({ name: 'character-list' })
  })

  it('does not redirect while online data is not loaded', () => {
    expect(gameGuard('H', isMember, false)).toBeUndefined()
  })
})

describe('gamePartyGuard', () => {
  it('lets that game\'s characters through', () => {
    expect(gamePartyGuard('G', 'a,b', getGameChar, metaOf)).toBeUndefined()
  })

  it('drops other games\' characters, free characters, drafts and missing ids', () => {
    expect(gamePartyGuard('G', 'a, c ,f,g,missing,b', getGameChar, metaOf))
      .toEqual({ name: 'game-party', params: { gameId: 'G', ids: 'a,b' } })
  })

  it('falls back to the table when no id belongs to the game', () => {
    expect(gamePartyGuard('G', 'c,f', getGameChar, metaOf)).toEqual({ name: 'game', params: { gameId: 'G' } })
    expect(gamePartyGuard('G', '', getGameChar, metaOf)).toEqual({ name: 'game', params: { gameId: 'G' } })
    expect(gamePartyGuard('G', undefined, getGameChar, metaOf)).toEqual({ name: 'game', params: { gameId: 'G' } })
  })

  it('does not redirect while online data is not loaded', () => {
    expect(gamePartyGuard('G', 'c', getGameChar, metaOf, false)).toBeUndefined()
  })
})

describe('partyGameRedirect', () => {
  it('sends a character in a game to that game\'s table, with its teammates from the list', () => {
    expect(partyGameRedirect('a,c,b', getGameChar, metaOf))
      .toEqual({ name: 'game-party', params: { gameId: 'G', ids: 'a,b' } })
  })

  it('skips drafts and missing ids when picking the game', () => {
    expect(partyGameRedirect('missing,g,c', getGameChar, metaOf))
      .toEqual({ name: 'game-party', params: { gameId: 'H', ids: 'c' } })
  })

  it('leaves a party that starts with a free character alone', () => {
    expect(partyGameRedirect('f,a', getGameChar, metaOf)).toBeUndefined()
    expect(partyGameRedirect('missing', getGameChar, metaOf)).toBeUndefined()
    expect(partyGameRedirect(undefined, getGameChar, metaOf)).toBeUndefined()
  })

  it('does not redirect while online data is not loaded', () => {
    expect(partyGameRedirect('a', getGameChar, metaOf, false)).toBeUndefined()
  })
})

describe('levelUpGuard', () => {
  it('lets an active character through', () => {
    expect(levelUpGuard('a', getById)).toBeUndefined()
  })

  it('redirects drafts and missing characters to the list', () => {
    expect(levelUpGuard('d', getById)).toEqual({ name: 'character-list' })
    expect(levelUpGuard('missing', getById)).toEqual({ name: 'character-list' })
  })

  it('does not redirect while online data is not loaded', () => {
    expect(levelUpGuard('missing', getById, false)).toBeUndefined()
  })

  it('sends a character the player cannot edit back to its sheet on its game table', () => {
    const canEdit = (id: string) => id === 'a'
    expect(levelUpGuard('b', getById, true, canEdit, () => 'g1'))
      .toEqual({ name: 'game-party', params: { gameId: 'g1', ids: 'b' } })
  })

  it('sends a free character the player cannot edit to the party route', () => {
    expect(levelUpGuard('b', getById, true, () => false)).toEqual({ name: 'party', params: { ids: 'b' } })
  })

  it('lets an editable character through and still refuses drafts first', () => {
    expect(levelUpGuard('a', getById, true, () => true, () => 'g1')).toBeUndefined()
    expect(levelUpGuard('d', getById, true, () => false)).toEqual({ name: 'character-list' })
  })
})
