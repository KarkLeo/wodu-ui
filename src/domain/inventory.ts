import type { Character, InventoryItem } from '@/types/character'
import { findGearTemplate } from '@/data/gear'

export function isConsumable(item: InventoryItem): boolean {
  return (item.descriptor.kind === 'gear' || item.descriptor.kind === 'occult')
    && item.descriptor.consumable === true
}

export function buyItem(char: Character, templateId: string): Character {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return char
  const cost = tpl.price ?? 0
  const descriptor = tpl.descriptor
  const consumable = (descriptor.kind === 'gear' || descriptor.kind === 'occult') && descriptor.consumable
  if (consumable) {
    const existing = char.inventory.find(i => i.name === tpl.name && isConsumable(i))
    if (existing) {
      return {
        ...char,
        inventory: char.inventory.map(i =>
          i.id === existing.id ? { ...i, quantity: (i.quantity ?? 1) + 1 } : i
        ),
        coins: Math.max(0, char.coins - cost),
      }
    }
  }
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    templateId: tpl.templateId,
    name: tpl.name,
    descriptor: tpl.descriptor,
    damage: tpl.damage,
    price: tpl.price,
    notes: tpl.notes,
  }
  return {
    ...char,
    inventory: [...char.inventory, item],
    coins: Math.max(0, char.coins - cost),
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
    coins: price !== undefined ? Math.max(0, char.coins - price) : char.coins,
  }
}

export function removeItem(char: Character, itemId: string): Character {
  return {
    ...char,
    inventory: char.inventory.filter(i => i.id !== itemId),
  }
}

export function useItem(char: Character, itemId: string): Character {
  const item = char.inventory.find(i => i.id === itemId)
  if (!item) return char
  if ((item.quantity ?? 1) <= 1) {
    return { ...char, inventory: char.inventory.filter(i => i.id !== itemId) }
  }
  return {
    ...char,
    inventory: char.inventory.map(i =>
      i.id === itemId ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i
    ),
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

export function drinkQuicksilver(char: Character): Character {
  return { ...char, quicksilverCount: (char.quicksilverCount ?? 0) + 1 }
}

export function resetQuicksilver(char: Character): Character {
  return { ...char, quicksilverCount: 0 }
}
