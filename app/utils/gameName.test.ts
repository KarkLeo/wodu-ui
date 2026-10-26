import { describe, expect, it } from 'vitest'
import { GAME_NAME_MAX, gameNameError } from './gameName'

describe('gameNameError', () => {
  it('accepts a name of 1 to 80 characters after trimming', () => {
    expect(gameNameError('K')).toBeNull()
    expect(gameNameError('  Shadows over Crookhollow  ')).toBeNull()
    expect(gameNameError('x'.repeat(GAME_NAME_MAX))).toBeNull()
    expect(gameNameError(` ${'x'.repeat(GAME_NAME_MAX)} `)).toBeNull()
  })

  it('refuses an empty or blank name', () => {
    expect(gameNameError('')).toBe('empty')
    expect(gameNameError('   ')).toBe('empty')
  })

  it('refuses a name over 80 characters', () => {
    expect(GAME_NAME_MAX).toBe(80)
    expect(gameNameError('x'.repeat(GAME_NAME_MAX + 1))).toBe('tooLong')
  })
})
