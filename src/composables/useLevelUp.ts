import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { Character, SkillId, AbilityId, StatKey, Magic } from '@/types/character'
import { ABILITIES } from '@/types/character'
import { sturdinessBonus } from '@/utils/derived'
import { getReward } from '@/data/xpTable'
import type { CharacterCommand, LevelUpPatch } from '@/domain/commands'
import { createLogger } from '@/utils/logger'

const log = createLogger('levelup')

type Dispatcher = (cmd: CharacterCommand) => void
type Phase = 'hitDice' | 'skill' | 'ability' | 'stat' | 'confirm'

export function useLevelUp(char: ComputedRef<Character | undefined>, dispatch: Dispatcher) {
  const targetLevel = computed(() => (char.value ? char.value.level + 1 : 1))
  const reward = computed(() => getReward(targetLevel.value))

  // Накапливаемый патч (внутри composable, не в компоненте)
  const pending = ref<Partial<LevelUpPatch>>({})
  const phase = ref<Phase>('hitDice')
  const done = ref({ hitDice: false, skill: false, ability: false, stat: false })

  function advance() {
    const r = reward.value
    if (!r || !char.value) return
    log.debug('advance', { phase: phase.value, done: { ...done.value } })
    if (r.hitDice && !done.value.hitDice) { phase.value = 'hitDice'; return }
    if (r.skills && !done.value.skill) { phase.value = 'skill'; return }
    if (r.abilities && !done.value.ability) {
      const currentIds = pending.value.abilityIds ?? char.value.abilityIds
      const hasOptions = ABILITIES.some(a => !currentIds.includes(a.id))
      if (hasOptions) { phase.value = 'ability'; return }
      done.value.ability = true
    }
    if (r.statBonus && !done.value.stat) { phase.value = 'stat'; return }
    phase.value = 'confirm'
  }

  function init() {
    if (!char.value || !reward.value) return
    log.info('init', { charId: char.value.id, targetLevel: targetLevel.value, reward: reward.value })
    pending.value = {}
    done.value = { hitDice: false, skill: false, ability: false, stat: false }
    // автобонус к урону
    if (reward.value.damageDice) {
      pending.value.damageBonusDice = (char.value.damageBonusDice ?? 0) + reward.value.damageDice
    }
    advance()
  }

  function onHitDice(hpRoll: number) {
    if (!char.value) return
    log.debug('onHitDice', { hpRoll })
    const newMaxHp = char.value.maxHp + hpRoll
    const existing = pending.value.hpHistory ?? char.value.hpHistory ?? []
    pending.value = {
      ...pending.value,
      maxHp: newMaxHp,
      currentHp: char.value.currentHp + hpRoll,
      hitDice: (char.value.hitDice ?? 1) + 1,
      hpHistory: [...existing, { level: targetLevel.value, roll: hpRoll, source: 'dice' as const }],
    }
    done.value.hitDice = true
    advance()
  }

  function pickSkill(sid: SkillId) {
    if (!char.value) return
    log.debug('pickSkill', { sid })
    const current = pending.value.skillIds ?? char.value.skillIds
    pending.value = { ...pending.value, skillIds: [...current, sid] }
    done.value.skill = true
    advance()
  }

  function pickAbility(aid: AbilityId) {
    if (!char.value) return
    log.debug('pickAbility', { aid })
    const current = pending.value.abilityIds ?? char.value.abilityIds
    const newAbilityIds = [...current, aid]
    const updates: Partial<LevelUpPatch> = { ...pending.value, abilityIds: newAbilityIds }
    if (aid === 'summoning' && !char.value.magic) {
      updates.magic = { spirits: [], rituals: [], cantrips: [] } satisfies Magic
    }
    if (aid === 'sturdy') {
      const bonus = sturdinessBonus([aid])
      const existing = pending.value.hpHistory ?? char.value.hpHistory ?? []
      updates.maxHp = (pending.value.maxHp ?? char.value.maxHp) + bonus
      updates.currentHp = (pending.value.currentHp ?? char.value.currentHp) + bonus
      updates.hpHistory = [...existing, { level: targetLevel.value, roll: 6, source: 'sturdy' as const }]
    }
    pending.value = updates
    done.value.ability = true
    advance()
  }

  function bumpStat(key: StatKey) {
    if (!char.value) return
    log.debug('bumpStat', { key })
    const base = pending.value.stats ?? char.value.stats
    pending.value = { ...pending.value, stats: { ...base, [key]: Math.min(3, base[key] + 1) } }
    done.value.stat = true
    advance()
  }

  function confirm() {
    if (!char.value) return
    log.info('confirm', { charId: char.value.id, pending: { ...pending.value } })
    const patch: LevelUpPatch = {
      level: targetLevel.value,
      maxHp: pending.value.maxHp ?? char.value.maxHp,
      currentHp: pending.value.currentHp ?? char.value.currentHp,
      hitDice: pending.value.hitDice ?? char.value.hitDice,
      hpHistory: pending.value.hpHistory ?? char.value.hpHistory ?? [],
      skillIds: pending.value.skillIds ?? char.value.skillIds,
      abilityIds: pending.value.abilityIds ?? char.value.abilityIds,
      stats: pending.value.stats ?? char.value.stats,
      damageBonusDice: pending.value.damageBonusDice ?? char.value.damageBonusDice,
      magic: pending.value.magic ?? char.value.magic,
    }
    dispatch({ type: 'LEVEL_UP', patch })
  }

  return { targetLevel, reward, phase, done, pending, init, onHitDice, pickSkill, pickAbility, bumpStat, confirm }
}
