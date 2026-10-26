import { describe, it, expect } from 'vitest'
import {
  INVITE_ALPHABET,
  generateInviteCode,
  formatInviteCode,
  normalizeInviteCode,
  inviteLink,
} from './inviteCode'

describe('generateInviteCode', () => {
  it('returns 8 characters from the alphabet', () => {
    let i = 0
    const code = generateInviteCode(() => (i++ % 32) / 32)
    expect(code).toHaveLength(8)
    expect([...code].every((ch) => INVITE_ALPHABET.includes(ch))).toBe(true)
  })

  it('maps random() onto the alphabet ends', () => {
    expect(generateInviteCode(() => 0)).toBe('AAAAAAAA')
    expect(generateInviteCode(() => 0.999999)).toBe('99999999')
  })

  it('works with the default random source', () => {
    expect(normalizeInviteCode(generateInviteCode())).not.toBeNull()
  })
})

describe('formatInviteCode / normalizeInviteCode', () => {
  it('formats with a dash', () => {
    expect(formatInviteCode('K7QX29AB')).toBe('K7QX-29AB')
  })

  it('round-trips', () => {
    expect(normalizeInviteCode(formatInviteCode('K7QX29AB'))).toBe('K7QX29AB')
  })

  it('accepts lowercase, spaces and dashes', () => {
    expect(normalizeInviteCode('k7qx 29-ab')).toBe('K7QX29AB')
  })

  it('rejects characters outside the alphabet', () => {
    expect(normalizeInviteCode('K7QX29A0')).toBeNull()
    expect(normalizeInviteCode('K7QX29AI')).toBeNull()
  })

  it('rejects wrong lengths', () => {
    expect(normalizeInviteCode('K7QX29A')).toBeNull()
    expect(normalizeInviteCode('K7QX29ABC')).toBeNull()
    expect(normalizeInviteCode('')).toBeNull()
  })
})

describe('inviteLink', () => {
  it('joins origin and code', () => {
    expect(inviteLink('https://wodu.karkleo.com', 'K7QX29AB')).toBe('https://wodu.karkleo.com/join/K7QX29AB')
  })
})
