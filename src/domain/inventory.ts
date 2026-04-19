import type { Character, InventoryItem } from '@/types/character'
import { findGearTemplate } from '@/data/gear'

export function buyItem(char: Character, templateId: string): Character {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return char
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: tpl.name,
    descriptor: tpl.descriptor,
    damage: tpl.damage,
    price: tpl.price,
    notes: tpl.notes,
  }
  return {
    ...char,
    inventory: [...char.inventory, item],
    coins: Math.max(0, char.coins - (tpl.price ?? 0)),
  }
}

export function receiveItem(char: Character, item: Omit<InventoryItem, 'id'>): Character {
  return {
    ...char,
    inventory: [...char.inventory, { ...item, id: crypto.randomUUID() }],
  }
}

export function addCustomItem(char: Character, name: string, price?: number): Character {
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name,
    descriptor: { kind: 'custom' },
    price,
  }
  return {
    ...char,
    inventory: [...char.inventory, item],
    coins: price ? Math.max(0, char.coins - price) : char.coins,
  }
}

export function removeItem(char: Character, itemId: string): Character {
  return {
    ...char,
    inventory: char.inventory.filter(i => i.id !== itemId),
  }
}

export function equipItem(char: Character, itemId: string): Character {
  return {
    ...char,
    inventory: char.inventory.map(i =>
      i.id === itemId ? { ...i, equipped: true } : i
    ),
  }
}

export function unequipItem(char: Character, itemId: string): Character {
  return {
    ...char,
    inventory: char.inventory.map(i =>
      i.id === itemId ? { ...i, equipped: false } : i
    ),
  }
}

export function setCoins(char: Character, amount: number): Character {
  return { ...char, coins: Math.max(0, amount) }
}
