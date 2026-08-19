import { t } from './index'
import type { Messages } from './en'
import type { AbilityId, ClassId, SkillId, StatKey } from '@/types/character'

export function skillName(id: SkillId): string {
  return t(`content.skills.${id}` as never)
}

export function abilityName(id: AbilityId): string {
  return t(`content.abilities.${id}.name` as never)
}

export function abilityDescription(id: AbilityId): string {
  return t(`content.abilities.${id}.description` as never)
}

export function className(id: ClassId): string {
  return t(`content.classes.${id}` as never)
}

export function statLabel(key: StatKey): string {
  return t(`content.stats.${key}.full` as never)
}

export function statShort(key: StatKey): string {
  return t(`content.stats.${key}.short` as never)
}

// Compile-time guards: a missing entry in any dictionary breaks the build.
type _SkillsComplete = Messages['content']['skills'] extends Record<SkillId, string> ? true : never
type _AbilitiesComplete =
  Messages['content']['abilities'] extends Record<AbilityId, { name: string; description: string }>
    ? true
    : never
type _ClassesComplete = Messages['content']['classes'] extends Record<ClassId, string> ? true : never
type _StatsComplete =
  Messages['content']['stats'] extends Record<StatKey, { full: string; short: string }> ? true : never

const _guards: [_SkillsComplete, _AbilitiesComplete, _ClassesComplete, _StatsComplete] = [
  true,
  true,
  true,
  true,
]
void _guards
