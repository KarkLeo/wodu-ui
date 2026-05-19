import { rollNotation as engineRoll } from '@/services/DiceEngine'
import { isAnimating, enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { pb } from '@/transport/pb'
import { markRollPlayedLocally } from '@/transport/bootstrap'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useToastsStore } from '@/stores/toasts'
import { parseDamageNotation } from '@/utils/derived'
import type { RollMode, RollPurpose, RollRecord } from '@/types/dice'
import type { StatKey } from '@/types/character'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('dice')

export const isRolling = isAnimating

function persistRoll(record: RollRecord): void {
  markRollPlayedLocally(record.id)
  useRollHistoryStore().addLocal(record)
  void enqueueDice(record.dice, record.notation)
  void pb
    .collection('roll_events')
    .create({
      id: record.id,
      character_id: record.characterId,
      data: record,
    })
    .catch((err) => {
      log.error('persistRoll: PB create failed', { id: record.id, err })
      useToastsStore().push(t('errors.rollSyncFailed'), 'error')
    })
}

export function useDiceRoller() {
  function buildRecord(params: {
    notation: string
    modifier?: number
    label: string
    purpose: RollPurpose
    characterId: string
    characterName?: string
    minTotal?: number
    rollMode?: RollMode
  }): RollRecord {
    const mode = params.rollMode ?? 'normal'
    const outcome = engineRoll(params.notation, mode)
    const modifier = params.modifier ?? 0
    const rawTotal = outcome.total + modifier
    const total = params.minTotal !== undefined ? Math.max(params.minTotal, rawTotal) : rawTotal
    const record: RollRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      notation: params.notation,
      dice: outcome.dice,
      diceTotal: outcome.total,
      modifier,
      total,
      label: params.label,
      purpose: params.purpose,
      characterId: params.characterId,
      characterName: params.characterName,
    }
    if (mode !== 'normal') {
      record.rollMode = mode
      if (outcome.discardedDice) record.discardedDice = outcome.discardedDice
      if (outcome.discardedTotal !== undefined) {
        record.discardedTotal = outcome.discardedTotal + modifier
      }
    }
    return record
  }

  function roll(params: {
    notation: string
    modifier?: number
    label: string
    purpose: RollPurpose
    characterId: string
    characterName?: string
    minTotal?: number
    rollMode?: RollMode
  }): RollRecord {
    log.debug('roll', { notation: params.notation, label: params.label, purpose: params.purpose.kind, characterId: params.characterId })
    const record = buildRecord(params)
    persistRoll(record)
    return record
  }

  function rollStat(characterId: string, characterName: string | undefined, statKey: StatKey, statLabel: string, statBonus: number) {
    const sign = statBonus >= 0 ? `+${statBonus}` : String(statBonus)
    return roll({
      notation: '2d6',
      modifier: statBonus,
      label: `${statLabel} (2d6${sign})`,
      purpose: { kind: 'stat', statKey, statBonus },
      characterId,
      characterName,
    })
  }

  function rollDamage(
    characterId: string,
    characterName: string | undefined,
    weaponName: string,
    baseDamage: string,
    damageBonusDice: number,
    flatBonus: number = 0,
  ) {
    const cleanDamage = parseDamageNotation(baseDamage)
    const weaponFull = damageBonusDice > 0 ? `${cleanDamage}+${damageBonusDice}d6` : cleanDamage
    const diceCounts = new Map<number, number>()
    let fixedMod = 0
    for (const raw of weaponFull.split(/(?=[+\-])/)) {
      const term = raw.trim()
      if (!term) continue
      const m = term.match(/^([+\-]?)(\d*)d(\d+)$/i)
      if (m) {
        const sign = m[1] === '-' ? -1 : 1
        const count = (m[2] ? Number(m[2]) : 1) * sign
        const sides = Number(m[3])
        diceCounts.set(sides, (diceCounts.get(sides) ?? 0) + count)
      } else {
        fixedMod += Number(term)
      }
    }
    const diceTerms: string[] = []
    for (const [sides, count] of diceCounts) {
      if (count === 0) continue
      diceTerms.push(`${count}d${sides}`)
    }
    const notation = diceTerms.join('+').replace(/\+\-/g, '-')
    const modifier = fixedMod + flatBonus
    const modStr = modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ''
    const label = `${weaponName}: ${notation}${modStr}`
    return roll({
      notation,
      modifier,
      label,
      purpose: { kind: 'damage', weaponName, formula: `${notation}${modStr}` },
      characterId,
      characterName,
      minTotal: 0,
    })
  }

  function rollFree(
    characterId: string,
    characterName: string | undefined,
    notation: string,
    rollMode: RollMode = 'normal',
  ) {
    return roll({
      notation,
      modifier: 0,
      label: notation,
      purpose: { kind: 'free', notation },
      characterId,
      characterName,
      rollMode,
    })
  }

  function rollBatch(
    items: Array<{
      notation: string
      modifier?: number
      label: string
      purpose: RollPurpose
      minTotal?: number
    }>,
    ctx: { characterId: string; characterName?: string },
  ): RollRecord[] {
    if (items.length === 0) return []
    const records = items.map(item => buildRecord({ ...item, characterId: ctx.characterId, characterName: ctx.characterName }))
    log.debug('rollBatch', { count: records.length })
    for (const record of records) persistRoll(record)
    return records
  }

  return { roll, rollStat, rollDamage, rollFree, rollBatch, isRolling }
}
