import { describe, it, expect } from 'vitest'
import { canEdit, isMaster, itemSources } from './permissions'
import type { Game, GameMember, CharacterMeta } from '@/types/game'

const game: Game = { id: 'G', name: 'Table', master: 'm', inviteCode: 'K7QX29AB' }
const members: GameMember[] = [
  { id: 'r1', game: 'G', user: 'm', name: 'Master' },
  { id: 'r2', game: 'G', user: 'p', name: 'Player' },
]
const playerChar: CharacterMeta = { owner: 'p', game: 'G' }

describe('canEdit', () => {
  it('lets the owner edit', () => {
    expect(canEdit(playerChar, 'p', game, members)).toBe(true)
    expect(canEdit({ owner: 'p', game: '' }, 'p', undefined, [])).toBe(true)
  })

  it('lets the master edit a member character in their game', () => {
    expect(canEdit(playerChar, 'm', game, members)).toBe(true)
  })

  it('does not let the master edit after the owner left', () => {
    expect(canEdit(playerChar, 'm', game, [members[0]!])).toBe(false)
  })

  it('does not let the master of another game edit', () => {
    const other: Game = { ...game, id: 'H', master: 'x' }
    expect(canEdit(playerChar, 'x', other, members)).toBe(false)
  })

  it('does not let the master edit a free character', () => {
    expect(canEdit({ owner: 'p', game: '' }, 'm', game, members)).toBe(false)
  })

  it('does not let a player edit the master character', () => {
    expect(canEdit({ owner: 'm', game: 'G' }, 'p', game, members)).toBe(false)
  })

  it('is false for unknown meta or no user', () => {
    expect(canEdit(undefined, 'p', game, members)).toBe(false)
    expect(canEdit(playerChar, null, game, members)).toBe(false)
    expect(canEdit({ owner: '', game: 'G' }, null, game, members)).toBe(false)
  })

  it('is false when the game is unknown', () => {
    expect(canEdit(playerChar, 'm', undefined, members)).toBe(false)
  })
})

describe('isMaster', () => {
  it('matches the master id', () => {
    expect(isMaster(game, 'm')).toBe(true)
    expect(isMaster(game, 'p')).toBe(false)
    expect(isMaster(game, null)).toBe(false)
    expect(isMaster(undefined, 'm')).toBe(false)
  })

  it('is false for a masterless game', () => {
    expect(isMaster({ ...game, master: '' }, '')).toBe(false)
  })
})

describe('itemSources', () => {
  const catalog = { catalog: true, fromLibrary: false }
  const library = { catalog: false, fromLibrary: true }
  const neither = { catalog: false, fromLibrary: false }

  it('offers the catalog to a draft, for the owner and the master alike', () => {
    expect(itemSources('draft', playerChar, game, 'p')).toEqual(catalog)
    expect(itemSources('draft', playerChar, game, 'm')).toEqual(catalog)
  })

  it('offers a player nothing on their active character in a game with a master', () => {
    expect(itemSources('active', playerChar, game, 'p')).toEqual(neither)
  })

  it('offers the master the library on a player character', () => {
    expect(itemSources('active', playerChar, game, 'm')).toEqual(library)
  })

  it('offers the master the library on their own character too', () => {
    expect(itemSources('active', { owner: 'm', game: 'G' }, game, 'm')).toEqual(library)
  })

  it('offers the catalog on a free character', () => {
    expect(itemSources('active', { owner: 'p', game: '' }, game, 'p')).toEqual(catalog)
  })

  it('offers the catalog in a masterless game', () => {
    expect(itemSources('active', playerChar, { ...game, master: '' }, 'p')).toEqual(catalog)
  })

  it('offers the catalog offline, without meta', () => {
    expect(itemSources('active', undefined, undefined, null)).toEqual(catalog)
  })

  it('offers the catalog when the game is unknown or another one', () => {
    expect(itemSources('active', playerChar, undefined, 'm')).toEqual(catalog)
    expect(itemSources('active', playerChar, { ...game, id: 'H' }, 'm')).toEqual(catalog)
  })
})
