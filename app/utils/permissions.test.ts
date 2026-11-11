import { describe, it, expect } from 'vitest'
import { canEdit, canGiveFromLibrary, canSeeTrueName, isMaster } from './permissions'
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

describe('canSeeTrueName', () => {
  it('shows it to the owner, in a game or free', () => {
    expect(canSeeTrueName(playerChar, 'p', game)).toBe(true)
    expect(canSeeTrueName({ owner: 'p', game: '' }, 'p', undefined)).toBe(true)
  })

  it('shows it to the master of the character\'s game', () => {
    expect(canSeeTrueName(playerChar, 'm', game)).toBe(true)
  })

  it('hides it from another player at the table', () => {
    expect(canSeeTrueName(playerChar, 'q', game)).toBe(false)
    expect(canSeeTrueName({ owner: 'm', game: 'G' }, 'p', game)).toBe(false)
  })

  it('hides it from the master of another game', () => {
    expect(canSeeTrueName(playerChar, 'x', { ...game, id: 'H', master: 'x' })).toBe(false)
  })

  it('hides it from everyone but the owner in a masterless game', () => {
    expect(canSeeTrueName(playerChar, '', { ...game, master: '' })).toBe(false)
    expect(canSeeTrueName(playerChar, 'q', { ...game, master: '' })).toBe(false)
  })

  it('hides a free character\'s from a master', () => {
    expect(canSeeTrueName({ owner: 'p', game: '' }, 'm', game)).toBe(false)
  })

  it('is false for unknown meta, no user or an unknown game', () => {
    expect(canSeeTrueName(undefined, 'p', game)).toBe(false)
    expect(canSeeTrueName(playerChar, null, game)).toBe(false)
    expect(canSeeTrueName(playerChar, 'm', undefined)).toBe(false)
  })
})

describe('canGiveFromLibrary', () => {
  it('lets the master hand out on a player character in their game', () => {
    expect(canGiveFromLibrary('active', playerChar, game, 'm')).toBe(true)
  })

  it('lets the master hand out on their own character too', () => {
    expect(canGiveFromLibrary('active', { owner: 'm', game: 'G' }, game, 'm')).toBe(true)
  })

  it('does not let a player hand out', () => {
    expect(canGiveFromLibrary('active', playerChar, game, 'p')).toBe(false)
  })

  it('offers no library to a draft', () => {
    expect(canGiveFromLibrary('draft', playerChar, game, 'm')).toBe(false)
  })

  it('offers no library on a free character or in a masterless game', () => {
    expect(canGiveFromLibrary('active', { owner: 'p', game: '' }, game, 'm')).toBe(false)
    expect(canGiveFromLibrary('active', playerChar, { ...game, master: '' }, 'p')).toBe(false)
  })

  it('offers no library offline, without meta', () => {
    expect(canGiveFromLibrary('active', undefined, undefined, null)).toBe(false)
  })

  it('offers no library when the game is unknown or another one', () => {
    expect(canGiveFromLibrary('active', playerChar, undefined, 'm')).toBe(false)
    expect(canGiveFromLibrary('active', playerChar, { ...game, id: 'H' }, 'm')).toBe(false)
  })
})
