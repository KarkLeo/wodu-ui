import { describe, expect, it } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import {
  authGate,
  defaultDisplayName,
  isAuthRejected,
  isNotUniqueEmailError,
  isPlausibleEmail,
  normalizeEmail,
  resolveLanguage,
  sanitizeCode,
} from './authHelpers'

const emailError = (code: string) =>
  new ClientResponseError({ status: 400, response: { data: { email: { code } } } })

describe('email input', () => {
  it('normalizes case and surrounding spaces', () => {
    expect(normalizeEmail('  Anna@Mail.COM ')).toBe('anna@mail.com')
  })

  it('accepts a plain address and rejects obvious non-addresses', () => {
    expect(isPlausibleEmail('anna@mail.com')).toBe(true)
    expect(['', 'anna', 'anna@', '@mail.com', 'a b@mail.com'].some(isPlausibleEmail)).toBe(false)
  })
})

describe('sanitizeCode', () => {
  it('keeps digits only, at most eight', () => {
    expect(sanitizeCode('2451 1566')).toBe('24511566')
    expect(sanitizeCode('2451-1566-99')).toBe('24511566')
    expect(sanitizeCode('ab12')).toBe('12')
  })
})

describe('defaultDisplayName', () => {
  it('takes the part before @, cut to 40 characters', () => {
    expect(defaultDisplayName('anna.k@mail.com')).toBe('anna.k')
    expect(defaultDisplayName(`${'x'.repeat(60)}@mail.com`)).toHaveLength(40)
  })
})

describe('server errors', () => {
  it('recognizes only the not-unique email error', () => {
    expect(isNotUniqueEmailError(emailError('validation_not_unique'))).toBe(true)
    expect(isNotUniqueEmailError(emailError('validation_is_email'))).toBe(false)
    expect(isNotUniqueEmailError(new Error('x'))).toBe(false)
  })

  it('treats 401/403/404 as a rejected session, a network failure as not', () => {
    expect([401, 403, 404].every(status => isAuthRejected(new ClientResponseError({ status })))).toBe(true)
    expect(isAuthRejected(new ClientResponseError({ status: 0 }))).toBe(false)
    expect(isAuthRejected(new Error('timeout'))).toBe(false)
  })
})

describe('resolveLanguage', () => {
  it('writes the device language to an empty or unknown profile value', () => {
    expect(resolveLanguage('', 'ru')).toEqual({ apply: 'ru', writeBack: true })
    expect(resolveLanguage('xx', 'en')).toEqual({ apply: 'en', writeBack: true })
  })

  it('applies a stored profile language', () => {
    expect(resolveLanguage('uk', 'ru')).toEqual({ apply: 'uk', writeBack: false })
  })
})

describe('authGate', () => {
  it('never gates offline mode', () => {
    expect(authGate('offline', false, '')).toBe('none')
  })

  it('asks to sign in, then for a name, then lets through', () => {
    expect(authGate('online', false, '')).toBe('sign-in')
    expect(authGate('online', true, '')).toBe('name')
    expect(authGate('online', true, 'Anna')).toBe('none')
  })
})
