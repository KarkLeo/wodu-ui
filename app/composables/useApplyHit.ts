import { computed } from 'vue'
import { useTable } from '@/composables/useTable'
import { useTableSelection } from '@/composables/useTableSelection'
import { canApplyRoll, monsterLabel, setHp } from '@/domain/encounter'
import { refuseReadOnly, useCharactersStore } from '@/stores/characters'
import { useEncounterStore } from '@/stores/encounter'
import { useToastsStore } from '@/stores/toasts'
import { currentUser } from '@/transport/auth'
import { recordHit, saveMonster } from '@/transport/encounter'
import { totalArmor } from '@/utils/derived'
import { isMaster } from '@/utils/permissions'
import { createLogger } from '@/utils/logger'
import type { RollRecord } from '@/types/dice'
import type { EncounterHit } from '@/types/encounter'
import { t } from '@/locales'

const log = createLogger('apply-hit')

export interface ApplyTarget {
  kind: 'monster' | 'character'
  id: string
  name: string
  armor: number
  hp: number
  tempHp: number
}

const RETRY_DELAY_MS = 400

// Shared by every caller: one application per roll and target at a time, wherever it was started from.
const inFlight = new Set<string>()

/**
 * The master's side of the log: what the selected monster or character could take from a damage roll,
 * and the application itself. For anyone but the master of the open table it offers nothing and asks the
 * server for nothing.
 */
export function useApplyHit() {
  const characters = useCharactersStore()
  const encounter = useEncounterStore()
  const { game } = useTable()
  const { selection } = useTableSelection()

  const enabled = computed(() => {
    const g = game.value
    return !!g
      && isMaster(g, currentUser.value?.id ?? null)
      && encounter.gameId === g.id
      && encounter.status === 'ready'
  })

  const target = computed<ApplyTarget | null>(() => {
    const sel = selection.value
    if (!enabled.value || !sel) return null
    if (sel.kind === 'monster') {
      const m = encounter.monsterById(sel.id)
      if (!m || m.diedAt !== undefined) return null
      return { kind: 'monster', id: m.id, name: monsterLabel(m), armor: m.armor, hp: m.hp, tempHp: 0 }
    }
    const c = characters.getById(sel.id)
    if (!c) return null
    return { kind: 'character', id: c.id, name: c.name, armor: totalArmor(c), hp: c.currentHp, tempHp: c.tempHp ?? 0 }
  })

  const hits = computed<EncounterHit[]>(() => {
    if (!enabled.value) return []
    return encounter.hits
      .map((hit, i) => ({ hit, i }))
      .sort((a, b) => b.hit.at - a.hit.at || b.i - a.i)
      .map(x => x.hit)
  })

  function applicable(roll: RollRecord): boolean {
    if (!enabled.value || !target.value) return false
    const isDead = (id: string) => {
      const m = encounter.monsterById(id)
      return !m || m.diedAt !== undefined
    }
    return canApplyRoll(roll, selection.value, encounter.hits, isDead)
  }

  function hitsOf(rollId: string): EncounterHit[] {
    if (!enabled.value) return []
    return encounter.hits.filter(h => h.rollId === rollId)
  }

  async function writeHit(gameId: string, hit: EncounterHit) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await recordHit(gameId, hit)
        return
      } catch (err) {
        log.error('hit write failed', { id: hit.id, attempt, err })
        if (attempt === 1) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      }
    }
    // The mark stays local, so the roll is not offered to this target again.
    useToastsStore().push(t('errors.encounterHitFailed'), 'error')
  }

  /**
   * Applies `amount` of `roll` to the selected target and records the hit. Nothing is recorded when the
   * target's HP could not be changed.
   */
  async function apply(roll: RollRecord, amount: number): Promise<void> {
    const tg = target.value
    if (!tg || !enabled.value) return
    const key = `${roll.id}:${tg.id}`
    if (inFlight.has(key)) return
    if (encounter.hits.some(h => h.rollId === roll.id && h.target.id === tg.id)) return
    const gameId = encounter.gameId
    const dealt = Math.max(0, Math.floor(amount))
    inFlight.add(key)
    try {
      if (tg.kind === 'monster') {
        const current = encounter.monsterById(tg.id)
        if (!current || current.diedAt !== undefined) return
        if (dealt > 0) {
          const next = setHp(current, current.hp - dealt, Date.now())
          saveMonster(next)
        }
      } else if (dealt > 0) {
        if (!characters.getById(tg.id)) return
        if (!characters.canEditCharacter(tg.id)) {
          refuseReadOnly('apply hit', tg.id)
          return
        }
        try {
          await characters.dispatch(tg.id, { type: 'APPLY_DAMAGE', amount: dealt })
        } catch (err) {
          log.error('damage not applied, no hit recorded', { id: tg.id, err })
          return
        }
      }
      const hit: EncounterHit = {
        id: crypto.randomUUID(),
        rollId: roll.id,
        target: { kind: tg.kind, id: tg.id, name: tg.name },
        sourceName: roll.characterName ?? '',
        rollTotal: roll.total,
        armor: tg.armor,
        amount: dealt,
        at: Date.now(),
      }
      await writeHit(gameId, hit)
    } catch (err) {
      log.error('apply failed', { roll: roll.id, target: tg.id, err })
    } finally {
      inFlight.delete(key)
    }
  }

  return { target, enabled, hits, applicable, hitsOf, apply }
}
