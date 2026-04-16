/** Dungeon World stat modifier. Input: integer 1–18. */
export function statModifier(stat: number): number {
  if (stat <= 3) return -3
  if (stat <= 5) return -2
  if (stat <= 8) return -1
  if (stat <= 11) return 0
  if (stat <= 15) return 1
  if (stat <= 17) return 2
  return 3
}

export function xpThreshold(level: number): number {
  return level + 7
}

/** baseHp = класс-константа (Fighter = 10) */
export function calcMaxHp(baseHp: number, con: number): number {
  return baseHp + statModifier(con)
}

/** baseLoad = класс-константа (Fighter = 12) */
export function calcMaxLoad(baseLoad: number, str: number): number {
  return baseLoad + statModifier(str)
}
