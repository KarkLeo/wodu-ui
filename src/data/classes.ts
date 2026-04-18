import type { ClassData, ClassId } from '@/types/character'

export const CLASSES: Record<ClassId, ClassData> = {
  fighter: {
    id: 'fighter',
    name: 'Воин',
    grantedSkillIds: ['athletics'],
    abilityPool: ['skirmish', 'toughness', 'hewing', 'sturdy'],
    hasMagic: false,
  },
  thief: {
    id: 'thief',
    name: 'Вор',
    grantedSkillIds: ['stealth'],
    abilityPool: ['shadowStrike', 'luck', 'reflexes', 'skilled'],
    hasMagic: false,
  },
  cleric: {
    id: 'cleric',
    name: 'Жрец',
    grantedSkillIds: ['decipher', 'healing'],
    abilityPool: ['blessing', 'heal', 'turnUndead', 'vision'],
    hasMagic: false,
  },
  wizard: {
    id: 'wizard',
    name: 'Волшебник',
    grantedSkillIds: ['lore'],
    abilityPool: ['incantations', 'domination', 'ritual'],
    autoAbilityIds: ['summoning'],
    hasMagic: true,
  },
  ranger: {
    id: 'ranger',
    name: 'Следопыт',
    grantedSkillIds: ['survival'],
    abilityPool: ['pet', 'scouting', 'volley', 'savage'],
    hasMagic: false,
  },
}

export const CLASS_LIST: ClassData[] = Object.values(CLASSES)

export const MAGIC_ABILITY_IDS = ['summoning', 'domination', 'ritual', 'incantations'] as const
