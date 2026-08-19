import { t } from './index'
import type { Messages } from './en'
import type { AbilityId, ClassId, SkillId, StatKey } from '@/types/character'
import type { GearCategoryId, GearTemplateId } from '@/data/gear'
import type { SpherePresetId } from '@/data/spheres'

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

export function gearName(templateId: string | undefined, fallback = ''): string {
  if (!templateId) return fallback
  const translated = t(`content.gear.${templateId}.name` as never)
  return translated.startsWith('content.') ? fallback : translated
}

export function gearNotes(templateId: string | undefined): string | undefined {
  if (!templateId) return undefined
  const translated = t(`content.gear.${templateId}.notes` as never)
  if (translated.startsWith('content.') || translated === '') return undefined
  return translated
}

export function gearCategoryName(id: GearCategoryId): string {
  return t(`content.gearCategories.${id}` as never)
}

export function spherePresetName(id: SpherePresetId): string {
  return t(`content.spherePresets.${id}` as never)
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
type _GearComplete =
  Messages['content']['gear'] extends Record<GearTemplateId, { name: string; notes: string }>
    ? true
    : never
type _GearCategoriesComplete =
  Messages['content']['gearCategories'] extends Record<GearCategoryId, string> ? true : never
type _SpheresComplete =
  Messages['content']['spherePresets'] extends Record<SpherePresetId, string> ? true : never

const _guards: [
  _SkillsComplete,
  _AbilitiesComplete,
  _ClassesComplete,
  _StatsComplete,
  _GearComplete,
  _GearCategoriesComplete,
  _SpheresComplete,
] = [true, true, true, true, true, true, true]
void _guards
