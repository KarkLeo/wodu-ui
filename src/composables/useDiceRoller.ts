import { ref, readonly } from 'vue'
import { rollNotation, rollGroups } from '@/services/DiceBoxService'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { parseDamageNotation } from '@/utils/derived'
import type { DieResult, RollPurpose, RollRecord } from '@/types/dice'
import type { StatKey } from '@/types/character'
import { createLogger } from '@/utils/logger'

const log = createLogger('dice')
const _isRolling = ref(false)
export const isRolling = readonly(_isRolling)

export function useDiceRoller() {
  const historyStore = useRollHistoryStore()

  async function roll(params: {
    notation: string
    modifier?: number
    label: string
    purpose: RollPurpose
    characterId: string
    characterName?: string
    minTotal?: number
  }): Promise<RollRecord | undefined> {
    if (_isRolling.value) {
      log.warn('roll: blocked (already rolling)', { notation: params.notation, label: params.label })
      return undefined
    }
    log.debug('roll: start', { notation: params.notation, label: params.label, purpose: params.purpose.kind, characterId: params.characterId })
    _isRolling.value = true
    try {
      const dice = await rollNotation(params.notation)
      const diceTotal = dice.reduce((s, d) => s + d.value, 0)
      const modifier = params.modifier ?? 0
      const rawTotal = diceTotal + modifier
      const total = params.minTotal !== undefined ? Math.max(params.minTotal, rawTotal) : rawTotal
      const record: RollRecord = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        notation: params.notation,
        dice,
        diceTotal,
        modifier,
        total,
        label: params.label,
        purpose: params.purpose,
        characterId: params.characterId,
        characterName: params.characterName,
      }
      log.debug('roll: recording', { characterId: record.characterId, total: record.total, diceCount: dice.length })
      historyStore.addRecord(record)
      return record
    } finally {
      _isRolling.value = false
    }
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

  async function rollSilentGroups(notations: string[]): Promise<DieResult[][] | undefined> {
    if (_isRolling.value) {
      log.warn('rollSilentGroups: blocked (already rolling)', { notations })
      return undefined
    }
    log.debug('rollSilentGroups: start', { notations })
    _isRolling.value = true
    try {
      const groups = await rollGroups(notations)
      log.debug('rollSilentGroups: done', { groupCount: groups.length })
      return groups
    } finally {
      _isRolling.value = false
    }
  }

  async function rollSilent(notation: string): Promise<DieResult[] | undefined> {
    if (_isRolling.value) {
      log.warn('rollSilent: blocked (already rolling)', { notation })
      return undefined
    }
    log.debug('rollSilent: start', { notation })
    _isRolling.value = true
    try {
      const dice = await rollNotation(notation)
      log.debug('rollSilent: done', { count: dice.length, values: dice.map(d => d.value) })
      return dice
    } finally {
      _isRolling.value = false
    }
  }

  function recordRoll(params: {
    dice: DieResult[]
    modifier?: number
    label: string
    purpose: RollPurpose
    characterId: string
    characterName?: string
    notation: string
  }): RollRecord {
    const diceTotal = params.dice.reduce((s, d) => s + d.value, 0)
    const modifier = params.modifier ?? 0
    const record: RollRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      notation: params.notation,
      dice: params.dice,
      diceTotal,
      modifier,
      total: diceTotal + modifier,
      label: params.label,
      purpose: params.purpose,
      characterId: params.characterId,
      characterName: params.characterName,
    }
    log.debug('recordRoll', { characterId: record.characterId, label: record.label, purpose: record.purpose.kind, total: record.total })
    historyStore.addRecord(record)
    return record
  }

  function rollFree(characterId: string, characterName: string | undefined, notation: string) {
    return roll({
      notation,
      modifier: 0,
      label: notation,
      purpose: { kind: 'free', notation },
      characterId,
      characterName,
    })
  }

  return { roll, rollStat, rollDamage, rollFree, rollSilent, rollSilentGroups, recordRoll, isRolling }
}
