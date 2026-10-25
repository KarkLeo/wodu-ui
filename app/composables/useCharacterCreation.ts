import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import type { AbilityId, ClassId, Magic, SkillId, StatKey } from '@/types/character'
import type { CharacterCommand, HpHistoryEntry } from '@/domain/commands'
import { CLASSES } from '@/data/classes'
import { STAT_KEYS } from '@/data/xpTable'
import { createLogger } from '@/utils/logger'

const log = createLogger('creation')

function waitForActive(characters: ReturnType<typeof useCharactersStore>, id: string, timeoutMs = 2000): Promise<boolean> {
  const existing = characters.getById(id)
  if (existing?.status === 'active') return Promise.resolve(true)
  return new Promise((resolve) => {
    let stop = () => {}
    const timer = window.setTimeout(() => {
      stop()
      resolve(false)
    }, timeoutMs)
    stop = watch(
      () => characters.getById(id)?.status,
      (status) => {
        if (status === 'active') {
          window.clearTimeout(timer)
          stop()
          resolve(true)
        }
      },
    )
  })
}

export function useCharacterCreation() {
  const router = useRouter()
  const characters = useCharactersStore()
  const creation = useCreationStore()

  const draft = computed(() => (creation.draftId ? characters.getById(creation.draftId) : undefined))
  const step = computed(() => creation.step)

  function dispatch(cmd: CharacterCommand) {
    if (creation.draftId) {
      void characters.dispatch(creation.draftId, cmd)
    }
  }

  async function createDraft() {
    if (creation.draftId && characters.getById(creation.draftId)) {
      log.debug('createDraft: reusing existing', { id: creation.draftId })
      return characters.getById(creation.draftId)!
    }
    log.info('createDraft: new')
    const char = await characters.add({
      status: 'draft',
      classId: 'fighter',
      name: '',
      level: 1,
      xp: 0,
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      statRolls: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      hitDice: 1,
      currentHp: 0,
      maxHp: 0,
      skillIds: [...CLASSES.fighter.grantedSkillIds],
      abilityIds: [],
      inventory: [],
      coins: 60,
      damageBonusDice: 0,
      notes: '',
    })
    if (!char) {
      log.warn('createDraft: add returned null')
      return null
    }
    creation.setDraft(char.id)
    return char
  }

  function next() { creation.nextStep() }

  async function back() {
    if (creation.step === 1) {
      if (creation.draftId) {
        try { await characters.remove(creation.draftId) } catch (err) { log.error('back: remove failed', err) }
      }
      creation.reset()
      router.push('/')
    } else {
      creation.prevStep()
    }
  }

  async function finish() {
    if (!creation.draftId) {
      log.warn('finish: no draft')
      return
    }
    const id = creation.draftId
    log.info('finish', { draftId: id })
    try {
      await characters.dispatch(id, { type: 'FINALIZE_CHARACTER' })
    } catch (err) {
      log.error('finish: dispatch failed', err)
      return
    }
    const arrived = await waitForActive(characters, id)
    if (!arrived) {
      log.warn('finish: active status did not arrive within timeout')
      router.push('/')
      return
    }
    characters.setActive(id)
    creation.reset()
    router.push(`/character/${id}`)
  }

  function setName(name: string) { dispatch({ type: 'SET_NAME', name }) }
  function setTrueName(trueName: string) { dispatch({ type: 'SET_TRUE_NAME', trueName }) }
  function pickClass(classId: ClassId) { dispatch({ type: 'SET_CLASS', classId }) }
  function setCustomClassName(name: string) { dispatch({ type: 'SET_CUSTOM_CLASS_NAME', name }) }
  function setStatRoll(key: StatKey, roll: number, bonus: number) {
    dispatch({ type: 'SET_STAT_ROLL', key, roll, bonus })
  }
  function setStatRollsBatch(rolls: { key: StatKey; roll: number; bonus: number }[]) {
    dispatch({ type: 'SET_STAT_ROLLS_BATCH', rolls })
  }
  function toggleSkill(id: SkillId) { dispatch({ type: 'TOGGLE_SKILL', id }) }
  function toggleAbility(id: AbilityId) { dispatch({ type: 'TOGGLE_ABILITY', id }) }
  function setHitDiceResult(hitDice: number, maxHp: number, currentHp: number, hpHistory: HpHistoryEntry[]) {
    dispatch({ type: 'SET_HIT_DICE_RESULT', hitDice, maxHp, currentHp, hpHistory })
  }
  function updateMagic(magic: Magic) { dispatch({ type: 'UPDATE_MAGIC', magic }) }

  const classData = computed(() => draft.value ? CLASSES[draft.value.classId] : undefined)
  const autoSkills = computed<SkillId[]>(() => classData.value?.grantedSkillIds ?? [])
  const autoAbilities = computed<AbilityId[]>(() => classData.value?.autoAbilityIds ?? [])
  const requiredSkillPicks = computed(() => Math.max(0, 2 - autoSkills.value.length))
  const requiredAbilityPicks = computed(() => 2 - autoAbilities.value.length)
  const allRolled = computed(() => !!draft.value && STAT_KEYS.every(k => draft.value!.statRolls[k] > 0))

  const isStepValid = computed(() => {
    const d = draft.value
    if (!d) return false
    const s = step.value
    if (s === 1) {
      if (!d.name.trim() || !allRolled.value) return false
      if (d.classId === 'custom' && !d.customClassName?.trim()) return false
      return true
    }
    if (s === 2) {
      const picked = d.skillIds.filter(id => !autoSkills.value.includes(id))
      const pickedAb = d.abilityIds.filter(id => !autoAbilities.value.includes(id))
      return picked.length === requiredSkillPicks.value && pickedAb.length === requiredAbilityPicks.value
    }
    return d.maxHp > 0
  })

  return {
    draft,
    step,
    createDraft,
    dispatch,
    next,
    back,
    finish,
    // actions
    setName,
    setTrueName,
    pickClass,
    setCustomClassName,
    setStatRoll,
    setStatRollsBatch,
    toggleSkill,
    toggleAbility,
    setHitDiceResult,
    updateMagic,
    // computed validation
    classData,
    autoSkills,
    autoAbilities,
    requiredSkillPicks,
    requiredAbilityPicks,
    allRolled,
    isStepValid,
  }
}
