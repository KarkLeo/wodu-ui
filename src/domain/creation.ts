import type { Character, ClassId, SkillId, AbilityId, StatKey, Magic, Spirit } from '@/types/character'
import { CLASSES, MAGIC_ABILITY_IDS } from '@/data/classes'
import { getAbilityEffect, hasMagicAbility } from '@/data/abilities'
import type { HpHistoryEntry } from './commands'

export function setName(char: Character, name: string): Character {
  return { ...char, name }
}

export function setTrueName(char: Character, trueName: string): Character {
  return { ...char, trueName }
}

export function setCustomClassName(char: Character, name: string): Character {
  return { ...char, customClassName: name }
}

export function setClass(char: Character, classId: ClassId): Character {
  if (char.classId === classId) return char
  const cls = CLASSES[classId]
  const skillIds: SkillId[] = [...cls.grantedSkillIds]
  const abilityIds: AbilityId[] = [...(cls.autoAbilityIds ?? [])]
  let magic: Magic | undefined
  for (const id of abilityIds) {
    const eff = getAbilityEffect(id)
    if (eff?.initMagicOnAcquire) {
      magic = initMagicForClass(classId)
      break
    }
  }
  return {
    ...char,
    classId,
    customClassName: classId === 'custom' ? char.customClassName : undefined,
    skillIds,
    abilityIds,
    magic,
  }
}

export function setStatRoll(char: Character, key: StatKey, roll: number, bonus: number): Character {
  return {
    ...char,
    statRolls: { ...char.statRolls, [key]: roll },
    stats: { ...char.stats, [key]: bonus },
  }
}

export function setStatRollsBatch(
  char: Character,
  rolls: { key: StatKey; roll: number; bonus: number }[],
): Character {
  const statRolls = { ...char.statRolls }
  const stats = { ...char.stats }
  for (const r of rolls) {
    statRolls[r.key] = r.roll
    stats[r.key] = r.bonus
  }
  return { ...char, statRolls, stats }
}

export function toggleSkill(char: Character, id: SkillId): Character {
  const cls = CLASSES[char.classId]
  if (cls.grantedSkillIds.includes(id)) return char
  const required = Math.max(0, 2 - cls.grantedSkillIds.length)
  if (required === 0) return char
  const has = char.skillIds.includes(id)
  const auto = cls.grantedSkillIds
  const picked = char.skillIds.filter(x => !auto.includes(x))
  let nextPicked: SkillId[]
  if (has) {
    nextPicked = picked.filter(x => x !== id)
  } else {
    if (picked.length >= required) return char
    nextPicked = [...picked, id]
  }
  return { ...char, skillIds: [...auto, ...nextPicked] }
}

export function toggleAbility(char: Character, id: AbilityId): Character {
  const cls = CLASSES[char.classId]
  const auto = cls.autoAbilityIds ?? []
  if (auto.includes(id)) return char
  if (!cls.abilityPool.includes(id)) return char
  const required = 2 - auto.length
  const has = char.abilityIds.includes(id)
  const picked = char.abilityIds.filter(x => !auto.includes(x))
  let nextPicked: AbilityId[]
  if (has) {
    nextPicked = picked.filter(x => x !== id)
  } else {
    if (picked.length >= required) return char
    nextPicked = [...picked, id]
  }
  const nextAbilityIds: AbilityId[] = [...auto, ...nextPicked]

  let magic: Magic | undefined = char.magic
  const effect = getAbilityEffect(id)

  if (!has && effect?.initMagicOnAcquire && !magic) {
    magic = initMagicForClass(char.classId)
  }
  if (has && effect?.initMagicOnAcquire && char.classId !== 'wizard') {
    const stillHasMagic = nextAbilityIds.some(a => (MAGIC_ABILITY_IDS as readonly string[]).includes(a))
    if (!stillHasMagic) magic = undefined
  }
  if (!has && effect?.startingCantrips?.length) {
    const base = magic ?? initMagicForClass(char.classId)
    magic = { ...base, cantrips: effect.startingCantrips }
  }
  if (has && effect?.startingCantrips?.length && magic) {
    const otherSource = nextAbilityIds.find(a => {
      const e = getAbilityEffect(a)
      return e?.startingCantrips?.length
    })
    if (!otherSource) {
      magic = { ...magic, cantrips: [] }
    }
  }
  if (magic && !hasMagicAbility(nextAbilityIds) && char.classId !== 'wizard') {
    magic = undefined
  }

  return { ...char, abilityIds: nextAbilityIds, magic }
}

export function setHitDiceResult(
  char: Character,
  hitDice: number,
  maxHp: number,
  currentHp: number,
  hpHistory: HpHistoryEntry[],
): Character {
  return { ...char, hitDice, maxHp, currentHp, hpHistory }
}

function initMagicForClass(classId: ClassId): Magic {
  const spirits: Spirit[] = classId === 'wizard'
    ? [
        { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
        { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
      ]
    : []
  return { spirits, rituals: [], cantrips: [] }
}
