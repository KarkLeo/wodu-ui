import { GEAR_CATALOG, type GearTemplate } from '@/data/gear'
import { STARTER_MONSTERS } from '@/data/starterMonsters'
import { gearName, gearNotes, starterMonsterName, starterMonsterSpecial } from '@/locales/content'
import type { LibraryItem, LibraryMonster } from '@/types/library'

/** The read-only monsters every game's library starts with, in the current language. Never stored. */
export function starterMonsters(): LibraryMonster[] {
  return STARTER_MONSTERS.map(m => ({
    id: `starter-${m.starterId}`,
    name: starterMonsterName(m.starterId),
    hp: m.hp,
    armor: m.armor,
    damage: m.damage,
    special: starterMonsterSpecial(m.starterId),
  }))
}

/** The rulebook's equipment as read-only library entries, in the current language. Never stored. */
export function starterItems(): LibraryItem[] {
  return (GEAR_CATALOG as readonly GearTemplate[]).map((g) => {
    const item: LibraryItem = {
      id: `starter-${g.templateId}`,
      templateId: g.templateId,
      name: gearName(g.templateId),
      descriptor: g.descriptor,
    }
    if (g.damage !== undefined) item.damage = g.damage
    if (g.price !== undefined) item.price = g.price
    const notes = gearNotes(g.templateId)
    if (notes) item.notes = notes
    return item
  })
}
