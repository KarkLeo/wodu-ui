import { isGameMaster } from '@/composables/useRouteRecheck'
import { useDiceRoller } from '@/composables/useDiceRoller'
import { monsterLabel, touch } from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { saveMonster } from '@/transport/encounter'
import { damageRollParts } from '@/utils/derived'
import type { RollMode, RollPurpose, RollRecord } from '@/types/dice'
import type { EncounterMonster } from '@/types/encounter'
import { createLogger } from '@/utils/logger'

const log = createLogger('monster-rolls')

/** Dice rolled for a monster instance of the game I master; they log under the instance's numbered name. */
export function useMonsterRolls() {
  const dice = useDiceRoller()
  const encounter = useEncounterStore()

  function rollFor(
    monster: EncounterMonster,
    build: (label: string, current: EncounterMonster) => {
      notation: string
      modifier?: number
      label: string
      purpose: RollPurpose
      minTotal?: number
      rollMode?: RollMode
    },
  ): RollRecord | null {
    const gameId = encounter.gameId
    const current = encounter.monsterById(monster.id)
    if (!gameId || !current || !isGameMaster(gameId)) {
      log.error('roll refused: not the master of this encounter', { id: monster.id })
      return null
    }
    if (current.diedAt !== undefined) {
      log.error('roll refused: the monster is dead', { id: current.id })
      return null
    }
    const name = monsterLabel(current)
    const params = build(name, current)
    if (!params.notation) return null
    const record = dice.roll({
      ...params,
      characterId: current.id,
      characterName: name,
      monster: { id: current.id, n: current.n },
      gameId,
    })
    if (record) saveMonster(touch(current, Date.now()))
    return record
  }

  function rollAttack(monster: EncounterMonster): RollRecord | null {
    return rollFor(monster, (name, current) => {
      const { notation, modifier, formula } = damageRollParts(current.damage, 0, 0)
      return {
        notation,
        modifier,
        label: `${name}: ${formula}`,
        purpose: { kind: 'damage', weaponName: '', formula },
        minTotal: 0,
      }
    })
  }

  function rollFreeAs(monster: EncounterMonster, notation: string, mode: RollMode = 'normal'): RollRecord | null {
    return rollFor(monster, () => ({
      notation,
      modifier: 0,
      label: notation,
      purpose: { kind: 'free', notation },
      rollMode: mode,
    }))
  }

  return { rollAttack, rollFreeAs }
}
