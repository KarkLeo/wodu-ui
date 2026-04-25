import type { Character } from '@/types/character'

export function applyDamage(char: Character, amount: number): Character {
  const safe = Math.max(0, amount)
  const tempBefore = char.tempHp ?? 0
  const fromTemp = Math.min(tempBefore, safe)
  const fromHp = safe - fromTemp
  return {
    ...char,
    tempHp: tempBefore - fromTemp,
    currentHp: Math.max(0, char.currentHp - fromHp),
  }
}

export function heal(char: Character, amount: number): Character {
  const safe = Math.max(0, amount)
  return { ...char, currentHp: Math.min(char.maxHp, char.currentHp + safe) }
}

export function setTempHp(char: Character, amount: number): Character {
  const safe = Math.max(0, Math.floor(amount))
  return { ...char, tempHp: safe }
}

export function setArmorMod(char: Character, amount: number): Character {
  return { ...char, armorMod: Math.trunc(amount) || 0 }
}

export function setDamageMod(char: Character, amount: number): Character {
  return { ...char, damageMod: Math.trunc(amount) || 0 }
}
