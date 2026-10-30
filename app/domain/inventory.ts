import type { Character, InventoryItem, ItemDescriptor } from '@/types/character'
import { findGearTemplate } from '@/data/gear'

export function isConsumable(item: { descriptor: ItemDescriptor }): boolean {
  const d = item.descriptor
  if (d.kind === 'gear' || d.kind === 'occult' || d.kind === 'custom') return d.consumable === true
  return false
}

function stackConsumable(
  char: Character,
  key: { templateId?: string; libraryItemId?: string },
  amount = 1,
): Character | null {
  const { templateId, libraryItemId } = key
  const existing = char.inventory.find(i => isConsumable(i) && (
    (templateId && i.templateId === templateId) || (!templateId && libraryItemId && i.libraryItemId === libraryItemId)
  ))
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
  if (isConsumable(tpl)) {
    const stacked = stackConsumable(char, { templateId: tpl.templateId })
    if (stacked) {
      return { ...stacked, coins: Math.max(0, char.coins - cost) }
    }
  }
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    templateId: tpl.templateId,
    name: '',
    descriptor: tpl.descriptor,
    damage: tpl.damage,
    price: tpl.price,
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
    const stacked = stackConsumable(char, item, item.quantity ?? 1)
    if (stacked) return stacked
  }
  return {
    ...char,
    inventory: [...char.inventory, fullItem],
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
  let updated: Character
  if ((item.quantity ?? 1) <= 1) {
    updated = { ...char, inventory: char.inventory.filter(i => i.id !== itemId) }
  } else {
    updated = {
      ...char,
      inventory: char.inventory.map(i =>
        i.id === itemId ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i
      ),
    }
  }
  const tpl = item.templateId ? findGearTemplate(item.templateId) : undefined
  if (tpl?.useEffect === 'quicksilver') {
    return { ...updated, quicksilverCount: (char.quicksilverCount ?? 0) + 1 }
  }
  return updated
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

export function resetQuicksilver(char: Character): Character {
  return { ...char, quicksilverCount: 0 }
}
