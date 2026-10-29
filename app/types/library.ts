import type { ItemDescriptor } from '@/types/character'

export interface LibraryMonster {
  id: string
  name: string
  hp: number
  armor: number
  damage: string
  special?: string
  notes?: string
}

export interface LibraryItem {
  id: string
  name: string
  descriptor: ItemDescriptor
  damage?: string
  price?: number
  // shown to the player once handed out (monster notes stay master-only)
  notes?: string
  quantity?: number
}

export const LIBRARY_LIMITS = {
  name: 80,
  special: 500,
  notes: 2000,
  hpMax: 999,
  armorMax: 9,
  priceMax: 100000,
  quantityMax: 99,
} as const

export type ItemKindFilter = 'all' | ItemDescriptor['kind']
