import type { Character, InventoryItem } from '@/types/character'
import { findGearTemplate } from '@/data/gear'

export function isConsumable(item: InventoryItem): boolean {
  const d = item.descriptor
  if (d.kind === 'gear' || d.kind === 'occult') return d.consumable === true
  if (d.kind === 'custom') return d.consumable === true
  return false
}

function stackConsumable(char: Character, templateId: string | undefined, amount = 1): Character | null {
  if (!templateId) return null
  const existing = char.inventory.find(i => i.templateId === templateId && isConsumable(i))
  if (!existing) return null
  return {
    ...char,
    inventory: char.inventory.map(i =>
      i.id === existing.id ? { ...i, quantity: (i.quantity ?? 1) + amount } : i
    ),
  }
}

export function buyItem(char: Character, templateId: string): Character {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return char
  const cost = tpl.price ?? 0
  const descriptor = tpl.descriptor
  const consumable = (descriptor.kind === 'gear' || descriptor.kind === 'occult') && descriptor.consumable
  if (consumable) {
    const stacked = stackConsumable(char, tpl.templateId)
    if (stacked) {
      return { ...stacked, coins: Math.max(0, char.coins - cost) }
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
  const fullItem: InventoryItem = { ...item, id: crypto.randomUUID() }
  if (isConsumable(fullItem)) {
    const stacked = stackConsumable(char, item.templateId, item.quantity ?? 1)
    if (stacked) return stacked
  }
  return {
    ...char,
    inventory: [...char.inventory, fullItem],
  }
}

export function addCustomItem(
  char: Character,
  name: string,
  price?: number,
  notes?: string,
  consumable?: boolean,
  quantity?: number,
): Character {
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name,
    descriptor: { kind: 'custom', consumable },
    price,
    notes,
    quantity: consumable && quantity ? quantity : undefined,
  }
  return {
    ...char,
    inventory: [...char.inventory, item],
    coins: price !== undefined ? Math.max(0, char.coins - price) : char.coins,
  }
}

export function editCustomItem(
  char: Character,
  itemId: string,
  fields: { name: string; price?: number; notes?: string; consumable?: boolean; quantity?: number },
): Character {
  return {
    ...char,
    inventory: char.inventory.map(i => {
      if (i.id !== itemId || i.descriptor.kind !== 'custom') return i
      return {
        ...i,
        name: fields.name,
        price: fields.price,
        notes: fields.notes,
        quantity: fields.consumable && fields.quantity ? fields.quantity : undefined,
        descriptor: { kind: 'custom', consumable: fields.consumable },
      }
    }),
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
