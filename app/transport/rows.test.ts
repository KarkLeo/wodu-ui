import { describe, it, expect } from 'vitest'
import { characterCreateBody, eventCreateBody } from './rows'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

describe('characterCreateBody', () => {
  it('wraps the character with its owner', () => {
    const c = { id: 'char1' } as Character
    const body = characterCreateBody(c, 'u1')
    expect(body).toEqual({ id: 'char1', data: c, owner: 'u1', game: '' })
    expect(body.data).toBe(c)
  })
})

describe('eventCreateBody', () => {
  it('links a roll to its character', () => {
    const roll = { id: 'r1', characterId: 'c1' } as RollRecord
    expect(eventCreateBody(roll)).toEqual({
      id: 'r1', data: roll, character_id: 'c1', character: 'c1', game: '',
    })
  })

  it('links a change entry to its character', () => {
    const entry = { id: 'e1', characterId: 'c1' } as ChangeEntry
    expect(eventCreateBody(entry)).toEqual({
      id: 'e1', data: entry, character_id: 'c1', character: 'c1', game: '',
    })
  })
})

describe('game field', () => {
  it('defaults to an empty game', () => {
    const c = { id: 'char1' } as Character
    expect(characterCreateBody(c, 'u1').game).toBe('')
    const roll = { id: 'r1', characterId: 'c1' } as RollRecord
    expect(eventCreateBody(roll).game).toBe('')
  })

  it('passes the game through', () => {
    const c = { id: 'char1' } as Character
    expect(characterCreateBody(c, 'u1', 'G').game).toBe('G')
    const roll = { id: 'r1', characterId: 'c1' } as RollRecord
    expect(eventCreateBody(roll, 'G').game).toBe('G')
  })
})
