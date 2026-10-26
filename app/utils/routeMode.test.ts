import { describe, expect, it } from 'vitest'
import { initialMode, isOfflinePath, modeForPath } from './routeMode'

describe('isOfflinePath', () => {
  it('matches the offline table and everything under it', () => {
    expect(isOfflinePath('/offline')).toBe(true)
    expect(isOfflinePath('/offline/')).toBe(true)
    expect(isOfflinePath('/offline/party/a,b')).toBe(true)
    expect(isOfflinePath('/offline/new')).toBe(true)
    expect(isOfflinePath('/offline/character/a/levelup')).toBe(true)
  })

  it('ignores case, as the router does', () => {
    expect(isOfflinePath('/Offline/Party/a')).toBe(true)
  })

  it('does not match other addresses that merely start alike', () => {
    expect(isOfflinePath('/offlineish')).toBe(false)
    expect(isOfflinePath('/')).toBe(false)
    expect(isOfflinePath('/games/offline')).toBe(false)
    expect(isOfflinePath('/party/offline')).toBe(false)
  })
})

describe('modeForPath', () => {
  it('the offline table runs offline', () => {
    expect(modeForPath('/offline')).toBe('offline')
    expect(modeForPath('/offline/party/a')).toBe('offline')
  })

  it('every other address belongs to the account', () => {
    expect(modeForPath('/games')).toBe('online')
    expect(modeForPath('/games/G/party/a')).toBe('online')
    expect(modeForPath('/party/a')).toBe('online')
    expect(modeForPath('/character/new')).toBe('online')
    expect(modeForPath('/join/ABCD2345')).toBe('online')
    expect(modeForPath('/unknown')).toBe('online')
  })

  it('the landing asks for no mode', () => {
    expect(modeForPath('/')).toBeNull()
    expect(modeForPath('')).toBeNull()
  })
})

describe('initialMode', () => {
  it('follows the address', () => {
    expect(initialMode('/offline/new')).toBe('offline')
    expect(initialMode('/games/G')).toBe('online')
  })

  it('opens the landing offline, so it never reaches the server', () => {
    expect(initialMode('/')).toBe('offline')
  })
})
