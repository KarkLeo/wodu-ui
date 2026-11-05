import { rollNotation as engineRoll } from '@/services/DiceEngine'
import { isAnimating, enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { backend } from '@/transport/backend'
import { modeSession } from '@/transport/mode'
import { reportWriteFailure } from '@/transport/writeFailure'
import { markRollPlayedLocally } from '@/transport/bootstrap'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { refuseReadOnly, useCharactersStore } from '@/stores/characters'
import { damageRollParts } from '@/utils/derived'
import type { RollMode, RollPurpose, RollRecord } from '@/types/dice'
import type { StatKey } from '@/types/character'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('dice')

export const isRolling = isAnimating

function persistRoll(record: RollRecord, game?: string): void {
  markRollPlayedLocally(record.id)
  useRollHistoryStore().addLocal(record)
  const dice = record.discardedDice ? [...record.dice, ...record.discardedDice] : record.dice
  void enqueueDice(dice, record.notation)
  const session = modeSession()
  void backend()
    .addRoll(record, game)
    .catch((err: unknown) => {
      log.error('persistRoll: write failed', { id: record.id, err })
      reportWriteFailure(err, t('errors.rollSyncFailed'), session)
    })
}

// A guard behind the UI: a read-only sheet offers no dice, but nothing may record a roll for it anyway.
function mayRoll(characterId: string): boolean {
  if (useCharactersStore().canEditCharacter(characterId)) return true
  refuseReadOnly('roll', characterId)
  return false
}

export function useDiceRoller() {
  function buildRecord(params: {
    notation: string
    modifier?: number
    label: string
    purpose: RollPurpose
    characterId: string
    characterName?: string
    monster?: { id: string; n: number }
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
      // Nothing in this app renders `label` anymore — do not remove it. Other
      // players' PWAs read RollRecord straight from PocketBase and may still be
      // running an older build that displays it, so it has to stay populated.
      label: params.label,
      purpose: params.purpose,
      characterId: params.characterId,
      characterName: params.characterName,
    }
    if (params.monster) record.monster = params.monster
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
    monster?: { id: string; n: number }
    gameId?: string
    minTotal?: number
    rollMode?: RollMode
  }): RollRecord | null {
    // Monsters have no character record for mayRoll to check; useMonsterRolls guards the master instead.
    if (!params.monster && !mayRoll(params.characterId)) return null
    log.debug('roll', { notation: params.notation, label: params.label, purpose: params.purpose.kind, characterId: params.characterId })
    const record = buildRecord(params)
    persistRoll(record, params.gameId)
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
    weaponTemplateId?: string,
  ) {
    const { notation, modifier, formula } = damageRollParts(baseDamage, damageBonusDice, flatBonus)
    const modStr = formula.slice(notation.length)
    const label = `${weaponName}: ${notation}${modStr}`
    return roll({
      notation,
      modifier,
      label,
      purpose: { kind: 'damage', weaponName, weaponTemplateId, formula },
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
    if (items.length === 0 || !mayRoll(ctx.characterId)) return []
    const records = items.map(item => buildRecord({ ...item, characterId: ctx.characterId, characterName: ctx.characterName }))
    log.debug('rollBatch', { count: records.length })
    for (const record of records) persistRoll(record)
    return records
  }

  return { roll, rollStat, rollDamage, rollFree, rollBatch, isRolling }
}
