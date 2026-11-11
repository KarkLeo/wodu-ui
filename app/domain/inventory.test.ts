import { describe, it, expect } from 'vitest'
import { ownedByTemplate } from './inventory'
import type { InventoryItem } from '@/types/character'

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: crypto.randomUUID(),
  name: '',
  descriptor: { kind: 'gear' },
  ...over,
})

describe('ownedByTemplate', () => {
  it('counts every copy of a catalog item', () => {
    const owned = ownedByTemplate([item({ templateId: 'rope' }), item({ templateId: 'rope' }), item({ templateId: 'torch' })])
    expect(owned).toEqual({ rope: 2, torch: 1 })
  })

  it('adds up a stack by its quantity', () => {
    const owned = ownedByTemplate([item({ templateId: 'torch', descriptor: { kind: 'gear', consumable: true }, quantity: 5 })])
    expect(owned).toEqual({ torch: 5 })
  })

  it('leaves out items that are not from the catalog', () => {
    expect(ownedByTemplate([item({ libraryItemId: 'L1', name: 'Moon wine' }), item({ name: 'Old key' })])).toEqual({})
  })
})
