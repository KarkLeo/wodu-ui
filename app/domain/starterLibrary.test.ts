import { afterEach, describe, expect, it } from 'vitest'
import { STARTER_MONSTERS } from '@/data/starterMonsters'
import { GEAR_CATALOG, findGearTemplate } from '@/data/gear'
import { LOCALES } from '@/locales'
import { currentLocale, FALLBACK_LOCALE } from '@/locales/locale'
import type { Character } from '@/types/character'
import { checkItem, checkMonster, libraryItemToInventory } from './library'
import { buyItem, receiveItem, useItem } from './inventory'
import { starterItems, starterMonsters } from './starterLibrary'

afterEach(() => {
  currentLocale.value = FALLBACK_LOCALE
})

describe('starter library', () => {
  it.each(LOCALES)('passes the library shape check in %s', (locale) => {
    currentLocale.value = locale
    for (const m of starterMonsters()) {
      expect(m.name).not.toMatch(/^content\./)
      expect(m.special).not.toMatch(/^content\./)
      expect(checkMonster(m)).toMatchObject({ ok: true })
    }
    for (const i of starterItems()) {
      expect(i.name).not.toMatch(/^content\./)
      expect(checkItem(i)).toMatchObject({ ok: true })
    }
  })

  it('covers every monster and the whole gear catalog, with unique ids', () => {
    const monsters = starterMonsters()
    const items = starterItems()
    expect(monsters).toHaveLength(STARTER_MONSTERS.length)
    expect(items).toHaveLength(GEAR_CATALOG.length)
    const ids = [...monsters, ...items].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never lets the catalog link reach a stored entry', () => {
    const shield = starterItems().find(i => i.templateId === 'shield')!
    const checked = checkItem(shield)
    expect(checked.ok && checked.value.templateId).toBeUndefined()
  })
})

describe('giving a starter item', () => {
  const char = { inventory: [], coins: 100 } as unknown as Character
  const starter = (templateId: string) => starterItems().find(i => i.templateId === templateId)!

  it('hands out the catalog item, with no library link', () => {
    const tpl = findGearTemplate('heavy_weapon')!
    expect(libraryItemToInventory(starter('heavy_weapon'))).toEqual({
      templateId: 'heavy_weapon',
      name: '',
      descriptor: tpl.descriptor,
      damage: tpl.damage,
      price: tpl.price,
    })
  })

  it('stacks a consumable with one bought from the catalog, and costs nothing', () => {
    const bought = buyItem(char, 'rations')
    const given = receiveItem(bought, libraryItemToInventory(starter('rations')))
    expect(given.inventory).toHaveLength(1)
    expect(given.inventory[0]!.quantity).toBe(2)
    expect(given.coins).toBe(bought.coins)
  })

  it('keeps the use-effect of the catalog item', () => {
    const given = receiveItem(char, libraryItemToInventory(starter('mercury')))
    const used = useItem(given, given.inventory[0]!.id)
    expect(used.quicksilverCount).toBe(1)
  })
})
