import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { Character, SkillId, AbilityId, StatKey, Magic } from '@/types/character'
import { ABILITIES, SKILLS } from '@/types/character'
import { getAbilityEffect } from '@/data/abilities'
import { getReward, MAX_STAT_BONUS, STAT_KEYS } from '@/data/xpTable'
import type { CharacterCommand, LevelUpPatch } from '@/domain/commands'
import { createLogger } from '@/utils/logger'

const log = createLogger('levelup')

type Dispatcher = (cmd: CharacterCommand) => void
export type LevelUpStep = 'skill' | 'ability' | 'stat' | 'hitDice'
export type LevelUpPhase = LevelUpStep | 'confirm'

const STEP_ORDER: LevelUpStep[] = ['skill', 'ability', 'stat', 'hitDice']

export function useLevelUp(char: ComputedRef<Character | undefined>, dispatch: Dispatcher) {
  const targetLevel = computed(() => (char.value ? char.value.level + 1 : 1))
  const reward = computed(() => getReward(targetLevel.value))

  const pending = ref<Partial<LevelUpPatch>>({})
  const phase = ref<LevelUpPhase>('skill')
  const done = ref({ skill: false, ability: false, stat: false, hitDice: false })
  // Snapshot pending state before each step commit, keyed by step.
  // Used to roll back pending changes when user navigates backward.
  const snapshots = ref<Partial<Record<LevelUpStep, Partial<LevelUpPatch>>>>({})

  function snapshotBefore(step: LevelUpStep) {
    snapshots.value[step] = { ...pending.value }
  }
  function restoreSnapshot(step: LevelUpStep) {
    const snap = snapshots.value[step]
    if (snap) pending.value = { ...snap }
  }

  const currentSkillIds = computed(() => pending.value.skillIds ?? char.value?.skillIds ?? [])
  const currentAbilityIds = computed(() => pending.value.abilityIds ?? char.value?.abilityIds ?? [])
  const currentStats = computed(() => pending.value.stats ?? char.value?.stats)

  const activeSteps = computed<LevelUpStep[]>(() => {
    const r = reward.value
    const c = char.value
    if (!r || !c) return []
    const steps: LevelUpStep[] = []
    if (r.skills) {
      const pool = SKILLS.filter(s => !currentSkillIds.value.includes(s.id))
      if (pool.length > 0) steps.push('skill')
    }
    if (r.abilities) {
      const pool = ABILITIES.filter(a => !currentAbilityIds.value.includes(a.id))
      if (pool.length > 0) steps.push('ability')
    }
    if (r.statBonus) {
      const any = currentStats.value && STAT_KEYS.some(k => currentStats.value![k] < MAX_STAT_BONUS)
      if (any) steps.push('stat')
    }
    if (r.hitDice) steps.push('hitDice')
    return steps
  })

  const currentStepIndex = computed(() => {
    if (phase.value === 'confirm') return activeSteps.value.length
    return activeSteps.value.indexOf(phase.value as LevelUpStep)
  })

  function isDone(step: LevelUpStep) {
    return done.value[step]
  }

  function advance() {
    const r = reward.value
    const c = char.value
    if (!r || !c) return
    log.debug('advance', { phase: phase.value, done: { ...done.value } })
    for (const step of STEP_ORDER) {
      if (done.value[step]) continue
      if (step === 'skill') {
        if (!r.skills) { done.value.skill = true; continue }
        const pool = SKILLS.filter(s => !currentSkillIds.value.includes(s.id))
        if (pool.length === 0) { done.value.skill = true; continue }
        phase.value = 'skill'; return
      }
      if (step === 'ability') {
        if (!r.abilities) { done.value.ability = true; continue }
        const pool = ABILITIES.filter(a => !currentAbilityIds.value.includes(a.id))
        if (pool.length === 0) { done.value.ability = true; continue }
        phase.value = 'ability'; return
      }
      if (step === 'stat') {
        if (!r.statBonus) { done.value.stat = true; continue }
        phase.value = 'stat'; return
      }
      if (step === 'hitDice') {
        if (!r.hitDice) { done.value.hitDice = true; continue }
        phase.value = 'hitDice'; return
      }
    }
    phase.value = 'confirm'
  }

  function init() {
    if (!char.value || !reward.value) return
    log.info('init', { charId: char.value.id, targetLevel: targetLevel.value, reward: reward.value })
    pending.value = {}
    done.value = { skill: false, ability: false, stat: false, hitDice: false }
    if (reward.value.damageDice) {
      pending.value.damageBonusDice = (char.value.damageBonusDice ?? 0) + reward.value.damageDice
    }
    advance()
  }

  function goBack(): boolean {
    const steps = activeSteps.value
    if (phase.value === 'confirm') {
      if (steps.length === 0) return false
      const prev = steps[steps.length - 1]
      restoreSnapshot(prev)
      done.value[prev] = false
      phase.value = prev
      return true
    }
    const idx = steps.indexOf(phase.value as LevelUpStep)
    if (idx > 0) {
      const prev = steps[idx - 1]
      restoreSnapshot(prev)
      done.value[prev] = false
      done.value[phase.value as LevelUpStep] = false
      phase.value = prev
      return true
    }
    return false
  }

  function jumpTo(step: LevelUpStep) {
    if (!activeSteps.value.includes(step)) return
    restoreSnapshot(step)
    const steps = activeSteps.value
    const idx = steps.indexOf(step)
    for (let i = idx; i < steps.length; i++) done.value[steps[i]] = false
    phase.value = step
  }

  function pickSkill(sid: SkillId) {
    if (!char.value) return
    log.debug('pickSkill', { sid })
    snapshotBefore('skill')
    const current = pending.value.skillIds ?? char.value.skillIds
    pending.value = { ...pending.value, skillIds: [...current, sid] }
    done.value.skill = true
    advance()
  }

  function pickAbility(aid: AbilityId) {
    if (!char.value) return
    log.debug('pickAbility', { aid })
    snapshotBefore('ability')
    const current = pending.value.abilityIds ?? char.value.abilityIds
    const newAbilityIds = [...current, aid]
    const updates: Partial<LevelUpPatch> = { ...pending.value, abilityIds: newAbilityIds }
    const effect = getAbilityEffect(aid)
    if (effect?.initMagicOnAcquire && !char.value.magic) {
      updates.magic = { spirits: [], rituals: [], cantrips: [] } satisfies Magic
    }
    if (effect?.hpBonusOnAcquire && effect.hpBonusSource) {
      const bonus = effect.hpBonusOnAcquire
      const existing = pending.value.hpHistory ?? char.value.hpHistory ?? []
      updates.maxHp = (pending.value.maxHp ?? char.value.maxHp) + bonus
      updates.currentHp = (pending.value.currentHp ?? char.value.currentHp) + bonus
      updates.hpHistory = [...existing, { level: targetLevel.value, roll: bonus, source: effect.hpBonusSource }]
    }
    pending.value = updates
    done.value.ability = true
    advance()
  }

  function bumpStat(key: StatKey) {
    if (!char.value) return
    log.debug('bumpStat', { key })
    snapshotBefore('stat')
    const base = pending.value.stats ?? char.value.stats
    pending.value = { ...pending.value, stats: { ...base, [key]: Math.min(MAX_STAT_BONUS, base[key] + 1) } }
    done.value.stat = true
    advance()
  }

  function onHitDice(hpRoll: number) {
    if (!char.value) return
    log.debug('onHitDice', { hpRoll })
    snapshotBefore('hitDice')
    const baseMaxHp = pending.value.maxHp ?? char.value.maxHp
    const baseCurrentHp = pending.value.currentHp ?? char.value.currentHp
    const newMaxHp = Math.max(baseMaxHp, hpRoll)
    const gain = newMaxHp - baseMaxHp
    const prevHistory = pending.value.hpHistory ?? char.value.hpHistory ?? []
    const nextHistory = gain > 0
      ? [...prevHistory, { level: targetLevel.value, roll: gain, source: 'dice' as const }]
      : prevHistory
    pending.value = {
      ...pending.value,
      maxHp: newMaxHp,
      currentHp: baseCurrentHp + gain,
      hitDice: (char.value.hitDice ?? 1) + 1,
      hpHistory: nextHistory,
    }
    done.value.hitDice = true
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

  return {
    targetLevel,
    reward,
    phase,
    done,
    pending,
    activeSteps,
    currentStepIndex,
    currentSkillIds,
    currentAbilityIds,
    currentStats,
    isDone,
    init,
    goBack,
    jumpTo,
    pickSkill,
    pickAbility,
    bumpStat,
    onHitDice,
    confirm,
  }
}
