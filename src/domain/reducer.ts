import type { Character, Stats, StatKey } from '@/types/character'
import type { CharacterCommand } from './commands'
import type { ChangeDraft } from '@/types/changeLog'
import * as inv from './inventory'
import * as combat from './combat'
import * as prog from './progression'
import * as mods from './modifiers'
import { findGearTemplate } from '@/data/gear'
import { createLogger } from '@/utils/logger'

const log = createLogger('domain')

export interface ApplyResult {
  character: Character
  changes: ChangeDraft[]
}

const STAT_LABEL: Record<StatKey, string> = {
  str: 'СИЛ',
  dex: 'ЛВК',
  con: 'ТЕЛ',
  int: 'ИНТ',
  wis: 'МУД',
  cha: 'ХАР',
}

function statsDiff(before: Stats, after: Stats): string {
  const parts: string[] = []
  for (const key of Object.keys(STAT_LABEL) as StatKey[]) {
    if (before[key] !== after[key]) {
      parts.push(`${STAT_LABEL[key]} ${before[key]}→${after[key]}`)
    }
  }
  return parts.join(', ')
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
          kind: 'inventory-add',
          label: cost > 0 ? `Куплено: ${name} (−${cost} м)` : `Куплено: ${name}`,
          delta: `+${name}`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'RECEIVE_ITEM': {
      next = inv.receiveItem(char, cmd.item)
      changes.push({
        kind: 'inventory-add',
        label: `Получено: ${cmd.item.name}`,
        delta: `+${cmd.item.name}`,
        sourceCommand: cmd.type,
      })
      break
    }
    case 'ADD_CUSTOM_ITEM': {
      next = inv.addCustomItem(char, cmd.name, cmd.price, cmd.notes, cmd.consumable, cmd.quantity)
      const cost = cmd.price ?? 0
      changes.push({
        kind: 'inventory-add',
        label: cost > 0 ? `Добавлено: ${cmd.name} (−${cost} м)` : `Добавлено: ${cmd.name}`,
        delta: `+${cmd.name}`,
        sourceCommand: cmd.type,
      })
      break
    }
    case 'EDIT_CUSTOM_ITEM': {
      const item = findItem(char, cmd.itemId)
      if (!item || item.descriptor.kind !== 'custom') break
      next = inv.editCustomItem(char, cmd.itemId, cmd)
      changes.push({
        kind: 'inventory-edit',
        label: `Изменён предмет: ${cmd.name}`,
        sourceCommand: cmd.type,
      })
      break
    }
    case 'REMOVE_ITEM': {
      const item = findItem(char, cmd.itemId)
      next = inv.removeItem(char, cmd.itemId)
      if (item) {
        changes.push({
          kind: 'inventory-remove',
          label: `Удалено: ${item.name}`,
          delta: `−${item.name}`,
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
        const label = before > 1
          ? `Использовано: ${item.name} (x${before} → x${after})`
          : `Использовано: ${item.name}`
        changes.push({
          kind: 'inventory-use',
          label,
          delta: `−1 ${item.name}`,
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
          kind: 'equip',
          label: `Надето: ${item.name}`,
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
          kind: 'unequip',
          label: `Снято: ${item.name}`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'SET_COINS': {
      const before = char.coins
      next = inv.setCoins(char, cmd.amount)
      if (next.coins !== before) {
        const diff = next.coins - before
        changes.push({
          kind: 'coins',
          label: `Монеты: ${before} → ${next.coins}`,
          delta: `${diff > 0 ? '+' : ''}${diff} м`,
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
      const total = fromTemp + fromHp
      if (total > 0) {
        let label: string
        if (fromTemp > 0 && fromHp > 0) {
          label = `Урон ${cmd.amount} (врем. ${tempBefore}→${tempAfter}, HP ${hpBefore}→${next.currentHp})`
        } else if (fromTemp > 0) {
          label = `Урон ${cmd.amount} (врем. ${tempBefore}→${tempAfter})`
        } else {
          label = `Урон ${cmd.amount} (HP ${hpBefore} → ${next.currentHp})`
        }
        changes.push({
          kind: 'hp-damage',
          label,
          delta: `−${total} HP`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'HEAL': {
      const before = char.currentHp
      next = combat.heal(char, cmd.amount)
      const actual = next.currentHp - before
      if (actual > 0) {
        changes.push({
          kind: 'hp-heal',
          label: `Лечение ${cmd.amount} (HP ${before} → ${next.currentHp})`,
          delta: `+${actual} HP`,
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
        const diff = after - before
        changes.push({
          kind: 'hp-temp',
          label: after === 0
            ? `Врем. HP сброшено (было ${before})`
            : `Врем. HP: ${before} → ${after}`,
          delta: `${diff > 0 ? '+' : ''}${diff} врем.`,
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
        const diff = after - before
        const fmt = (v: number) => (v > 0 ? `+${v}` : String(v))
        changes.push({
          kind: 'armor-mod',
          label: after === 0
            ? `Мод. брони сброшен (было ${fmt(before)})`
            : `Мод. брони: ${fmt(before)} → ${fmt(after)}`,
          delta: `${diff > 0 ? '+' : ''}${diff} брон.`,
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
        const diff = after - before
        const fmt = (v: number) => (v > 0 ? `+${v}` : String(v))
        changes.push({
          kind: 'damage-mod',
          label: after === 0
            ? `Мод. урона сброшен (было ${fmt(before)})`
            : `Мод. урона: ${fmt(before)} → ${fmt(after)}`,
          delta: `${diff > 0 ? '+' : ''}${diff} ур.`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'GAIN_XP': {
      const before = char.xp
      next = prog.gainXp(char, cmd.amount)
      if (next.xp !== before) {
        const diff = next.xp - before
        changes.push({
          kind: 'xp-gain',
          label: diff >= 0 ? `Получено ${diff} XP` : `Потеряно ${-diff} XP`,
          delta: `${diff > 0 ? '+' : ''}${diff} XP`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'LEVEL_UP': {
      const beforeLevel = char.level
      next = prog.levelUp(char, cmd.patch)
      changes.push({
        kind: 'level-up',
        label: `Уровень ${beforeLevel} → ${next.level}`,
        delta: `+${next.level - beforeLevel} ур.`,
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
        const sign = added.amount > 0 ? `+${added.amount}` : String(added.amount)
        changes.push({
          kind: 'modifier',
          label: `Эффект на ${STAT_LABEL[added.statKey]}: ${added.label} ${sign}`,
          delta: `${sign} ${STAT_LABEL[added.statKey]}`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'REMOVE_STAT_MODIFIER': {
      const target = (char.modifiers ?? []).find(m => m.id === cmd.modifierId)
      next = mods.removeModifier(char, cmd.modifierId)
      if (target) {
        const sign = target.amount > 0 ? `+${target.amount}` : String(target.amount)
        changes.push({
          kind: 'modifier',
          label: `Снят эффект: ${target.label} (${STAT_LABEL[target.statKey]} ${sign})`,
          delta: `−эффект ${STAT_LABEL[target.statKey]}`,
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
        const scope = cmd.statKey ? STAT_LABEL[cmd.statKey] : 'все статы'
        changes.push({
          kind: 'modifier',
          label: `Сняты эффекты: ${scope} (${removed})`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'UPDATE_MAGIC': {
      next = { ...char, magic: cmd.magic }
      changes.push({
        kind: 'magic',
        label: 'Обновлена магия',
        sourceCommand: cmd.type,
      })
      break
    }
    case 'UPDATE_STATS': {
      next = { ...char, stats: cmd.stats }
      const diff = statsDiff(char.stats, cmd.stats)
      if (diff) {
        changes.push({
          kind: 'stats',
          label: `Характеристики: ${diff}`,
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
          kind: 'quicksilver-reset',
          label: `Сброс ртути (было ${before})`,
          sourceCommand: cmd.type,
        })
      }
      break
    }
    case 'FINALIZE_CHARACTER': {
      next = { ...char, status: 'active' }
      changes.push({
        kind: 'create',
        label: `Персонаж создан: ${next.name || '—'}`,
        sourceCommand: cmd.type,
      })
      break
    }
    default: {
      const _exhaustive: never = cmd
      return { character: _exhaustive, changes: [] }
    }
  }

  return { character: next, changes }
}
