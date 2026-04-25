import type { AbilityId } from '@/types/character'

export type MagicSection = 'spirits' | 'rituals' | 'cantrips'
export type DamageScope = 'all' | 'melee' | 'ranged'

export interface AbilityEffect {
  grantsMagicSection?: MagicSection
  initMagicOnAcquire?: boolean
  hpBonusOnAcquire?: number
  hpBonusSource?: 'sturdy'
  startingCantrips?: string[]
  damageBonus?: { amount: number; scope: DamageScope }
  armorBonus?: number
  armorTreatedAsLighter?: boolean
}

export const ABILITY_EFFECTS: Partial<Record<AbilityId, AbilityEffect>> = {
  summoning:    { grantsMagicSection: 'spirits',  initMagicOnAcquire: true },
  ritual:       { grantsMagicSection: 'rituals' },
  incantations: { grantsMagicSection: 'cantrips', startingCantrips: ['Свеча', 'Тень', 'Чревовещание'] },
  sturdy:       { hpBonusOnAcquire: 6, hpBonusSource: 'sturdy' },
  skirmish:     { damageBonus: { amount: 1, scope: 'all' },    armorTreatedAsLighter: true },
  hewing:       { damageBonus: { amount: 2, scope: 'melee' } },
  volley:       { damageBonus: { amount: 2, scope: 'ranged' } },
  toughness:    { armorBonus: 1 },
}

export function getAbilityEffect(id: AbilityId): AbilityEffect | undefined {
  return ABILITY_EFFECTS[id]
}

export function hasMagicAbility(abilityIds: readonly AbilityId[]): boolean {
  return abilityIds.some(id => !!ABILITY_EFFECTS[id]?.grantsMagicSection)
}

export function grantsSection(abilityIds: readonly AbilityId[], section: MagicSection): boolean {
  return abilityIds.some(id => ABILITY_EFFECTS[id]?.grantsMagicSection === section)
}
