import type { ChangePayload } from '@/types/changeLog'
import { t } from '@/locales'
import { statShort } from '@/locales/content'

function signed(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount)
}

function signOf(amount: number): string {
  return amount > 0 ? '+' : amount < 0 ? '−' : ''
}

export function formatChangeLabel(payload: ChangePayload): string {
  switch (payload.kind) {
    case 'inventory-add':
      if (payload.source === 'buy') {
        return payload.cost && payload.cost > 0
          ? t('changeLog.boughtWithCost', { name: payload.itemName, cost: payload.cost })
          : t('changeLog.bought', { name: payload.itemName })
      }
      if (payload.source === 'custom') {
        return payload.cost && payload.cost > 0
          ? t('changeLog.addedCustomWithCost', { name: payload.itemName, cost: payload.cost })
          : t('changeLog.addedCustom', { name: payload.itemName })
      }
      return t('changeLog.received', { name: payload.itemName })
    case 'inventory-edit':
      return t('changeLog.edited', { name: payload.itemName })
    case 'inventory-remove':
      return t('changeLog.removed', { name: payload.itemName })
    case 'inventory-use':
      return payload.quantityBefore > 1
        ? t('changeLog.usedQty', { name: payload.itemName, before: payload.quantityBefore, after: payload.quantityAfter })
        : t('changeLog.used', { name: payload.itemName })
    case 'equip':
      return t('changeLog.equipped', { name: payload.itemName })
    case 'unequip':
      return t('changeLog.unequipped', { name: payload.itemName })
    case 'coins':
      return t('changeLog.coins', { before: payload.before, after: payload.after })
    case 'hp-damage': {
      const fromTemp = payload.tempBefore - payload.tempAfter
      const fromHp = payload.hpBefore - payload.hpAfter
      const params = {
        amount: payload.amount,
        tBefore: payload.tempBefore,
        tAfter: payload.tempAfter,
        hBefore: payload.hpBefore,
        hAfter: payload.hpAfter,
      }
      if (fromTemp > 0 && fromHp > 0) return t('changeLog.hpDamageBoth', params)
      if (fromTemp > 0) return t('changeLog.hpDamageTemp', params)
      return t('changeLog.hpDamageHp', params)
    }
    case 'hp-heal':
      return t('changeLog.hpHeal', { amount: payload.amount, before: payload.before, after: payload.after })
    case 'hp-temp':
      return payload.after === 0
        ? t('changeLog.tempReset', { before: payload.before })
        : t('changeLog.tempChange', { before: payload.before, after: payload.after })
    case 'armor-mod':
      return payload.after === 0
        ? t('changeLog.armorReset', { before: signed(payload.before) })
        : t('changeLog.armorChange', { before: signed(payload.before), after: signed(payload.after) })
    case 'damage-mod':
      return payload.after === 0
        ? t('changeLog.damageReset', { before: signed(payload.before) })
        : t('changeLog.damageChange', { before: signed(payload.before), after: signed(payload.after) })
    case 'xp-gain': {
      const diff = payload.after - payload.before
      return diff >= 0
        ? t('changeLog.xpGain', { amount: diff })
        : t('changeLog.xpLoss', { amount: -diff })
    }
    case 'level-up':
      return t('changeLog.levelUp', { before: payload.before, after: payload.after })
    case 'stats': {
      const parts = payload.changes
        .map(c => t('changeLog.statChange', { stat: statShort(c.key), before: c.before, after: c.after }))
        .join(', ')
      return t('changeLog.statsHeader', { parts })
    }
    case 'modifier-add':
      return t('changeLog.modifierAdd', {
        stat: statShort(payload.statKey),
        label: payload.label,
        sign: signed(payload.amount),
      })
    case 'modifier-remove':
      return t('changeLog.modifierRemove', {
        stat: statShort(payload.statKey),
        label: payload.label,
        sign: signed(payload.amount),
      })
    case 'modifier-clear': {
      const scope = payload.statKey ? statShort(payload.statKey) : t('changeLog.modifierClearAllScope')
      return t('changeLog.modifierClearScope', { scope, count: payload.count })
    }
    case 'magic':
      return t('changeLog.magic')
    case 'quicksilver-reset':
      return t('changeLog.quicksilverReset', { before: payload.before })
    case 'create':
      return t('changeLog.create', { name: payload.characterName })
  }
}

export function formatChangeDelta(payload: ChangePayload): string | undefined {
  switch (payload.kind) {
    case 'inventory-add':
      return t('changeLog.delta.itemPlus', { name: payload.itemName })
    case 'inventory-remove':
      return t('changeLog.delta.itemMinus', { name: payload.itemName })
    case 'inventory-use':
      return t('changeLog.delta.itemUseOne', { name: payload.itemName })
    case 'coins': {
      const diff = payload.after - payload.before
      return t('changeLog.delta.coins', { sign: diff > 0 ? '+' : '', amount: diff })
    }
    case 'hp-damage': {
      const total = (payload.tempBefore - payload.tempAfter) + (payload.hpBefore - payload.hpAfter)
      return t('changeLog.delta.hpDamage', { amount: total })
    }
    case 'hp-heal':
      return t('changeLog.delta.hpHeal', { amount: payload.after - payload.before })
    case 'hp-temp': {
      const diff = payload.after - payload.before
      return t('changeLog.delta.hpTemp', { sign: diff > 0 ? '+' : '', amount: diff })
    }
    case 'armor-mod': {
      const diff = payload.after - payload.before
      return t('changeLog.delta.armorMod', { sign: diff > 0 ? '+' : '', amount: diff })
    }
    case 'damage-mod': {
      const diff = payload.after - payload.before
      return t('changeLog.delta.damageMod', { sign: diff > 0 ? '+' : '', amount: diff })
    }
    case 'xp-gain': {
      const diff = payload.after - payload.before
      return t('changeLog.delta.xp', { sign: diff > 0 ? '+' : '', amount: diff })
    }
    case 'level-up':
      return t('changeLog.delta.level', { amount: payload.after - payload.before })
    case 'modifier-add':
      return t('changeLog.delta.modifierStat', {
        sign: signOf(payload.amount),
        amount: Math.abs(payload.amount),
        stat: statShort(payload.statKey),
      })
    case 'modifier-remove':
      return t('changeLog.delta.modifierRemoved', { stat: statShort(payload.statKey) })
    default:
      return undefined
  }
}

export function isCoinSpend(payload: ChangePayload): boolean {
  return payload.kind === 'coins' && payload.after < payload.before
}
