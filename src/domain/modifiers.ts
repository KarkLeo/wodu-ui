import type { Character, StatKey, StatModifier } from '@/types/character'

const MAX_LABEL_LENGTH = 32

export function addModifier(
  char: Character,
  statKey: StatKey,
  amount: number,
  label: string,
): Character {
  const cleanAmount = Math.trunc(amount)
  if (cleanAmount === 0) return char
  const cleanLabel = label.trim().slice(0, MAX_LABEL_LENGTH)
  if (!cleanLabel) return char
  const mod: StatModifier = {
    id: crypto.randomUUID(),
    statKey,
    amount: cleanAmount,
    label: cleanLabel,
  }
  return { ...char, modifiers: [...(char.modifiers ?? []), mod] }
}

export function removeModifier(char: Character, modifierId: string): Character {
  const list = char.modifiers ?? []
  const next = list.filter(m => m.id !== modifierId)
  if (next.length === list.length) return char
  return { ...char, modifiers: next }
}

export function clearModifiers(char: Character, statKey?: StatKey): Character {
  const list = char.modifiers ?? []
  if (!list.length) return char
  const next = statKey ? list.filter(m => m.statKey !== statKey) : []
  if (next.length === list.length) return char
  return { ...char, modifiers: next }
}
