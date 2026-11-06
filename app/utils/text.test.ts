import { describe, it, expect } from 'vitest'
import { cutText } from './text'

describe('cutText', () => {
  it('leaves text that fits', () => {
    expect(cutText('Goblin', 6)).toBe('Goblin')
    expect(cutText('😀', 2)).toBe('😀')
  })

  it('cuts to the limit', () => {
    expect(cutText('Goblin', 3)).toBe('Gob')
  })

  it('keeps an emoji that ends exactly at the limit', () => {
    expect(cutText('ab😀cd', 4)).toBe('ab😀')
  })

  it('drops an emoji the limit would split', () => {
    expect(cutText('abc😀d', 4)).toBe('abc')
    expect(cutText('😀', 1)).toBe('')
  })

  it('handles a limit of zero', () => {
    expect(cutText('Goblin', 0)).toBe('')
  })
})
