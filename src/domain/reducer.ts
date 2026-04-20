import type { Character } from '@/types/character'
import type { CharacterCommand } from './commands'
import * as inv from './inventory'
import * as combat from './combat'
import * as prog from './progression'

export function applyCommand(char: Character, cmd: CharacterCommand): Character {
  switch (cmd.type) {
    case 'BUY_ITEM':        return inv.buyItem(char, cmd.templateId)
    case 'RECEIVE_ITEM':    return inv.receiveItem(char, cmd.item)
    case 'ADD_CUSTOM_ITEM': return inv.addCustomItem(char, cmd.name, cmd.price)
    case 'REMOVE_ITEM':     return inv.removeItem(char, cmd.itemId)
    case 'USE_ITEM': {
      const item = char.inventory.find(i => i.id === cmd.itemId)
      const result = inv.useItem(char, cmd.itemId)
      if (item?.templateId === 'mercury') return { ...result, quicksilverCount: (char.quicksilverCount ?? 0) + 1 }
      return result
    }
    case 'EQUIP_ITEM':      return inv.equipItem(char, cmd.itemId)
    case 'UNEQUIP_ITEM':    return inv.unequipItem(char, cmd.itemId)
    case 'SET_COINS':       return inv.setCoins(char, cmd.amount)
    case 'APPLY_DAMAGE':    return combat.applyDamage(char, cmd.amount)
    case 'HEAL':            return combat.heal(char, cmd.amount)
    case 'GAIN_XP':         return prog.gainXp(char, cmd.amount)
    case 'LEVEL_UP':        return prog.levelUp(char, cmd.patch)
    case 'UPDATE_MAGIC':       return { ...char, magic: cmd.magic }
    case 'UPDATE_STATS':       return { ...char, stats: cmd.stats }
    case 'UPDATE_NOTES':       return { ...char, notes: cmd.notes }
    case 'DRINK_QUICKSILVER':  return inv.drinkQuicksilver(char)
    case 'RESET_QUICKSILVER':  return inv.resetQuicksilver(char)
  }
  const _exhaustive: never = cmd
  return _exhaustive
}
