import type { Character, Stats, StatKey } from '@/types/character'
import type { CharacterCommand } from './commands'
import type { ChangeDraft } from '@/types/changeLog'
import * as inv from './inventory'
import * as combat from './combat'
import * as prog from './progression'
import * as mods from './modifiers'
import * as creation from './creation'
import { findGearTemplate } from '@/data/gear'
import { createLogger } from '@/utils/logger'

const log = createLogger('domain')

export interface ApplyResult {
  character: Character
  changes: ChangeDraft[]
}

const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function statsChanges(before: Stats, after: Stats) {
  const out: { key: StatKey; before: number; after: number }[] = []
  for (const key of STAT_KEYS) {
    if (before[key] !== after[key]) out.push({ key, before: before[key], after: after[key] })
  }
  return out
}

function findItem(char: Character, id: string) {
  return char.inventory.find(i => i.id === id)
}

export function applyCommand(char: Character, cmd: CharacterCommand): ApplyResult {
  log.debug(cmd.type, { charId: char.id, charName: char.name, cmd })
  const changes: ChangeDraft[] = []
  let next: Character = char

  switch (cmd.type) {
    case 'BUY_ITEM': {
      const before = char
      next = inv.buyItem(char, cmd.templateId)
      if (next !== before) {
        const name = findGearTemplate(cmd.templateId)?.name ?? '—'
        const cost = before.coins - next.coins
        changes.push({
          payload: { kind: 'inventory-add', itemName: name, cost, source: 'buy' },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'RECEIVE_ITEM': {
      next = inv.receiveItem(char, cmd.item)
      changes.push({
        payload: { kind: 'inventory-add', itemName: cmd.item.name, source: 'receive' },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'ADD_CUSTOM_ITEM': {
      next = inv.addCustomItem(char, cmd.name, cmd.price, cmd.notes, cmd.consumable, cmd.quantity)
      changes.push({
        payload: { kind: 'inventory-add', itemName: cmd.name, cost: cmd.price, source: 'custom' },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'EDIT_CUSTOM_ITEM': {
      const item = findItem(char, cmd.itemId)
      if (!item || item.descriptor.kind !== 'custom') break
      next = inv.editCustomItem(char, cmd.itemId, cmd)
      changes.push({
        payload: { kind: 'inventory-edit', itemName: cmd.name },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'REMOVE_ITEM': {
      const item = findItem(char, cmd.itemId)
      next = inv.removeItem(char, cmd.itemId)
      if (item) {
        changes.push({
          payload: { kind: 'inventory-remove', itemName: item.name },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'USE_ITEM': {
      const item = findItem(char, cmd.itemId)
      next = inv.useItem(char, cmd.itemId)
      if (item) {
        const before = item.quantity ?? 1
        const after = Math.max(0, before - 1)
        changes.push({
          payload: { kind: 'inventory-use', itemName: item.name, quantityBefore: before, quantityAfter: after },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'EQUIP_ITEM': {
      const item = findItem(char, cmd.itemId)
      next = inv.equipItem(char, cmd.itemId)
      if (item) {
        changes.push({
          payload: { kind: 'equip', itemName: item.name },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'UNEQUIP_ITEM': {
      const item = findItem(char, cmd.itemId)
      next = inv.unequipItem(char, cmd.itemId)
      if (item) {
        changes.push({
          payload: { kind: 'unequip', itemName: item.name },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'SET_COINS': {
      const before = char.coins
      next = inv.setCoins(char, cmd.amount)
      if (next.coins !== before) {
        changes.push({
          payload: { kind: 'coins', before, after: next.coins },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'APPLY_DAMAGE': {
      const tempBefore = char.tempHp ?? 0
      const hpBefore = char.currentHp
      next = combat.applyDamage(char, cmd.amount)
      const tempAfter = next.tempHp ?? 0
      const fromTemp = tempBefore - tempAfter
      const fromHp = hpBefore - next.currentHp
      if (fromTemp + fromHp > 0) {
        changes.push({
          payload: { kind: 'hp-damage', amount: cmd.amount, tempBefore, tempAfter, hpBefore, hpAfter: next.currentHp },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'HEAL': {
      const before = char.currentHp
      next = combat.heal(char, cmd.amount)
      if (next.currentHp > before) {
        changes.push({
          payload: { kind: 'hp-heal', amount: cmd.amount, before, after: next.currentHp },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'SET_TEMP_HP': {
      const before = char.tempHp ?? 0
      next = combat.setTempHp(char, cmd.amount)
      const after = next.tempHp ?? 0
      if (after !== before) {
        changes.push({
          payload: { kind: 'hp-temp', before, after },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'SET_ARMOR_MOD': {
      const before = char.armorMod ?? 0
      next = combat.setArmorMod(char, cmd.amount)
      const after = next.armorMod ?? 0
      if (after !== before) {
        changes.push({
          payload: { kind: 'armor-mod', before, after },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'SET_DAMAGE_MOD': {
      const before = char.damageMod ?? 0
      next = combat.setDamageMod(char, cmd.amount)
      const after = next.damageMod ?? 0
      if (after !== before) {
        changes.push({
          payload: { kind: 'damage-mod', before, after },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'GAIN_XP': {
      const before = char.xp
      next = prog.gainXp(char, cmd.amount)
      if (next.xp !== before) {
        changes.push({
          payload: { kind: 'xp-gain', before, after: next.xp },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'LEVEL_UP': {
      const before = char.level
      next = prog.levelUp(char, cmd.patch)
      changes.push({
        payload: { kind: 'level-up', before, after: next.level },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'ADD_STAT_MODIFIER': {
      const before = char.modifiers ?? []
      next = mods.addModifier(char, cmd.statKey, cmd.amount, cmd.label)
      const after = next.modifiers ?? []
      const added = after.find(m => !before.some(b => b.id === m.id))
      if (added) {
        changes.push({
          payload: { kind: 'modifier-add', statKey: added.statKey, label: added.label, amount: added.amount },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'REMOVE_STAT_MODIFIER': {
      const target = (char.modifiers ?? []).find(m => m.id === cmd.modifierId)
      next = mods.removeModifier(char, cmd.modifierId)
      if (target) {
        changes.push({
          payload: { kind: 'modifier-remove', statKey: target.statKey, label: target.label, amount: target.amount },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'CLEAR_STAT_MODIFIERS': {
      const before = char.modifiers ?? []
      next = mods.clearModifiers(char, cmd.statKey)
      const removed = before.length - (next.modifiers ?? []).length
      if (removed > 0) {
        changes.push({
          payload: { kind: 'modifier-clear', statKey: cmd.statKey, count: removed },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'UPDATE_MAGIC': {
      next = { ...char, magic: cmd.magic }
      changes.push({
        payload: { kind: 'magic' },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'UPDATE_STATS': {
      next = { ...char, stats: cmd.stats }
      const diff = statsChanges(char.stats, cmd.stats)
      if (diff.length) {
        changes.push({
          payload: { kind: 'stats', changes: diff },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'UPDATE_NOTES': {
      next = { ...char, notes: cmd.notes }
      break
    }
    case 'RESET_QUICKSILVER': {
      const before = char.quicksilverCount ?? 0
      next = inv.resetQuicksilver(char)
      if (before > 0) {
        changes.push({
          payload: { kind: 'quicksilver-reset', before },
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'FINALIZE_CHARACTER': {
      next = { ...char, status: 'active' }
      changes.push({
        payload: { kind: 'create', characterName: next.name || '—' },
        sourceCommand: cmd.type,
      })
      break
    }
    case 'SET_NAME':
      next = creation.setName(char, cmd.name)
      break
    case 'SET_TRUE_NAME':
      next = creation.setTrueName(char, cmd.trueName)
      break
    case 'SET_CLASS':
      next = creation.setClass(char, cmd.classId)
      break
    case 'SET_CUSTOM_CLASS_NAME':
      next = creation.setCustomClassName(char, cmd.name)
      break
    case 'SET_STAT_ROLL':
      next = creation.setStatRoll(char, cmd.key, cmd.roll, cmd.bonus)
      break
    case 'TOGGLE_SKILL':
      next = creation.toggleSkill(char, cmd.id)
      break
    case 'TOGGLE_ABILITY':
      next = creation.toggleAbility(char, cmd.id)
      break
    case 'SET_HIT_DICE_RESULT':
      next = creation.setHitDiceResult(char, cmd.hitDice, cmd.maxHp, cmd.currentHp, cmd.hpHistory)
      break
    default: {
      const _exhaustive: never = cmd
      return { character: _exhaustive, changes: [] }
    }
  }

  return { character: next, changes }
}
