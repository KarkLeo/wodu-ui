// The rulebook has no bestiary, so these lines are authored to its scale: a torch bearer has 3 HP, an
// armsman 12 HP and armor 2 with a d6+1 spear, a champion 18 HP and armor 3 with a d6+2 halberd.
// Names and specials live in `content.starterMonsters`.
export const STARTER_MONSTERS = [
  { starterId: 'rat',      hp: 2,  armor: 0, damage: '1d4' },
  { starterId: 'goblin',   hp: 4,  armor: 0, damage: '1d6' },
  { starterId: 'bandit',   hp: 6,  armor: 1, damage: '1d6' },
  { starterId: 'guard',    hp: 12, armor: 2, damage: '1d6+1' },
  { starterId: 'knight',   hp: 18, armor: 3, damage: '1d6+2' },
  { starterId: 'cultist',  hp: 6,  armor: 0, damage: '1d6' },
  { starterId: 'wolf',     hp: 6,  armor: 0, damage: '1d6' },
  { starterId: 'bear',     hp: 18, armor: 1, damage: '1d6+2' },
  { starterId: 'spider',   hp: 8,  armor: 1, damage: '1d6' },
  { starterId: 'skeleton', hp: 6,  armor: 1, damage: '1d6' },
  { starterId: 'zombie',   hp: 10, armor: 0, damage: '1d6' },
  { starterId: 'ghoul',    hp: 10, armor: 0, damage: '1d6' },
  { starterId: 'ghost',    hp: 12, armor: 0, damage: '1d6' },
  { starterId: 'orc',      hp: 8,  armor: 1, damage: '1d6+1' },
  { starterId: 'ogre',     hp: 18, armor: 1, damage: '1d6+2' },
  { starterId: 'troll',    hp: 24, armor: 1, damage: '1d6+2' },
  { starterId: 'vampire',  hp: 24, armor: 1, damage: '1d6+1' },
  { starterId: 'dragon',   hp: 60, armor: 3, damage: '2d6+2' },
] as const

export type StarterMonsterId = (typeof STARTER_MONSTERS)[number]['starterId']
