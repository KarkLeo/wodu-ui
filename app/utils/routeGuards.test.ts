import { describe, expect, it } from 'vitest'
import { levelUpGuard, partyGuard } from './routeGuards'
import { makeCharacter } from '@/test/fixtures'
import type { Character } from '@/types/character'

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
})
