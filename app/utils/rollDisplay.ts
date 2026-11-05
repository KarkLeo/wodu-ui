import { currentLocale, t } from '@/locales'
import { gearName, statShort } from '@/locales/content'
import type { RollRecord } from '@/types/dice'

/** The outcome classes of a roll, shared by the log's row and the collapsed rail's value. */
export function rollClasses(r: RollRecord) {
  const isStat = r.purpose.kind === 'stat'
  const isD20 = r.notation.toLowerCase() === 'd20' || r.notation.toLowerCase() === '1d20'
  const crit =
    (isStat && r.total >= 12) ||
    (isD20 && r.diceTotal === 20)
  const success = isStat && !crit && r.total >= 10 && r.total <= 11
  const fail = isStat && !crit && r.total <= 6
  return {
    'is-crit': crit,
    'is-success': success,
    'is-fail': fail,
    'is-damage': r.purpose.kind === 'damage',
    'is-advantage': r.rollMode === 'advantage',
    'is-disadvantage': r.rollMode === 'disadvantage',
  }
}

export function rollExpr(r: RollRecord): string {
  const mod = r.modifier ? (r.modifier > 0 ? `+${r.modifier}` : String(r.modifier)) : ''
  return `${r.notation}${mod}`
}

/** What kind of roll it was: the first word of a row's meta line. */
export function rollKindLabel(r: RollRecord): string {
  if (r.purpose.kind === 'stat') return statShort(r.purpose.statKey)
  if (r.purpose.kind === 'damage') return t('diceDrawer.meta.damage')
  if (r.purpose.kind === 'hit-dice') return t('diceDrawer.rollMeta.hitDice')
  if (r.purpose.kind === 'hp-init') return t('diceDrawer.rollMeta.hpInit')
  if (r.rollMode === 'advantage') return t('diceDrawer.mode.advantage')
  if (r.rollMode === 'disadvantage') return t('diceDrawer.mode.disadvantage')
  return t('diceDrawer.meta.manual')
}

/** The weapon of a damage roll, in the viewer's language; empty for anything else and for a monster's attack. */
export function rollWeaponLabel(r: RollRecord): string {
  const p = r.purpose
  return p.kind === 'damage' && p.weaponName ? gearName(p.weaponTemplateId, p.weaponName) : ''
}

export function logTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(currentLocale.value, { hour: '2-digit', minute: '2-digit' })
}
