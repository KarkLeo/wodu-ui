import { ABILITY_IDS } from '@/types/character'
import type { AbilityId, ClassData, ClassId } from '@/types/character'

export const ALL_ABILITY_IDS: AbilityId[] = [...ABILITY_IDS]

export const CLASSES: Record<ClassId, ClassData> = {
  fighter: {
    id: 'fighter',
    grantedSkillIds: ['athletics'],
    abilityPool: ['skirmish', 'toughness', 'hewing', 'sturdy'],
    hasMagic: false,
  },
  thief: {
    id: 'thief',
    grantedSkillIds: ['stealth'],
    abilityPool: ['shadowStrike', 'luck', 'reflexes', 'skilled'],
    hasMagic: false,
  },
  cleric: {
    id: 'cleric',
    grantedSkillIds: ['decipher', 'healing'],
    abilityPool: ['blessing', 'heal', 'turnUndead', 'vision'],
    hasMagic: false,
  },
  wizard: {
    id: 'wizard',
    grantedSkillIds: ['lore'],
    abilityPool: ['incantations', 'domination', 'ritual'],
    autoAbilityIds: ['summoning'],
    hasMagic: true,
  },
  ranger: {
    id: 'ranger',
    grantedSkillIds: ['survival'],
    abilityPool: ['pet', 'scouting', 'volley', 'savage'],
    hasMagic: false,
  },
  custom: {
    id: 'custom',
    grantedSkillIds: [],
    abilityPool: ALL_ABILITY_IDS,
    hasMagic: false,
  },
}

export const CLASS_LIST: ClassData[] = Object.values(CLASSES)

export const MAGIC_ABILITY_IDS = ['summoning', 'domination', 'ritual', 'incantations'] as const
