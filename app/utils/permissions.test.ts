import { describe, it, expect } from 'vitest'
import { canEdit, isMaster } from './permissions'
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
