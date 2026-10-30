import { applyCommand } from '@/domain/reducer'
import type { CharacterCommand, LevelUpPatch } from '@/domain/commands'
import type { Character, StatKey } from '@/types/character'
import type { ChangeEntry } from '@/types/changeLog'
import type { RollRecord } from '@/types/dice'
import type { CharacterMeta, Game, GameMember } from '@/types/game'
import type { LibraryItem, LibraryMonster } from '@/types/library'
import { CLASSES } from '@/data/classes'
import { XP_THRESHOLDS } from '@/data/xpTable'

// Fixed clock so log timestamps (and therefore screenshots) are stable between runs.
export const STORY_NOW = Date.UTC(2026, 9, 22, 18, 30)

export type Step = CharacterCommand | ((char: Character) => CharacterCommand)

// Same shape useCharacterCreation.createDraft() produces, with a stable id.
function draft(id: string): Character {
  return {
    id,
    createdAt: STORY_NOW,
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
  }
}

export function build(id: string, steps: Step[]): Character {
  return steps.reduce<Character>((char, step) => {
    const cmd = typeof step === 'function' ? step(char) : step
    return applyCommand(char, cmd).character
  }, draft(id))
}

export function itemId(char: Character, templateId: string): string {
  const item = char.inventory.find((i) => i.templateId === templateId)
  if (!item) throw new Error(`fixture: no ${templateId} in ${char.id}`)
  return item.id
}

export const equip = (templateId: string): Step => (c) => ({ type: 'EQUIP_ITEM', itemId: itemId(c, templateId) })

function rolls(values: Record<StatKey, [roll: number, bonus: number]>): CharacterCommand {
  return {
    type: 'SET_STAT_ROLLS_BATCH',
    rolls: (Object.keys(values) as StatKey[]).map((key) => ({ key, roll: values[key][0], bonus: values[key][1] })),
  }
}

function levelUp(char: Character, to: number, hpRoll: number, extra: Partial<LevelUpPatch> = {}): CharacterCommand {
  const maxHp = char.maxHp + hpRoll
  return {
    type: 'LEVEL_UP',
    patch: {
      level: to,
      maxHp,
      currentHp: maxHp,
      hitDice: char.hitDice + 1,
      hpHistory: [...(char.hpHistory ?? []), { level: to, roll: hpRoll, source: 'dice' }],
      skillIds: char.skillIds,
      abilityIds: char.abilityIds,
      stats: char.stats,
      damageBonusDice: char.damageBonusDice,
      magic: char.magic,
      ...extra,
    },
  }
}

// ── Drafts: one per creation step ──────────────────────────────────────────

export const draftIdentity = build('story-draft-1', [])

export const draftTraining = build('story-draft-2', [
  { type: 'SET_NAME', name: 'Hallam' },
  { type: 'SET_CLASS', classId: 'cleric' },
  rolls({ str: [8, 1], dex: [6, 0], con: [9, 1], int: [7, 1], wis: [11, 2], cha: [5, 0] }),
])

export const draftGear = build('story-draft-3', [
  { type: 'SET_NAME', name: 'Hallam' },
  { type: 'SET_CLASS', classId: 'cleric' },
  rolls({ str: [8, 1], dex: [6, 0], con: [9, 1], int: [7, 1], wis: [11, 2], cha: [5, 0] }),
  { type: 'TOGGLE_ABILITY', id: 'heal' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 7, currentHp: 7, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'BUY_ITEM', templateId: 'light_weapon' },
])

// ── Active characters ──────────────────────────────────────────────────────

/** Fighter, level 1, full HP, armed and armoured. */
export const brann = build('story-brann', [
  { type: 'SET_NAME', name: 'Brann Ironhide' },
  rolls({ str: [11, 2], dex: [7, 1], con: [10, 2], int: [5, 0], wis: [6, 0], cha: [8, 1] }),
  { type: 'TOGGLE_SKILL', id: 'survival' },
  { type: 'TOGGLE_ABILITY', id: 'toughness' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 8, currentHp: 8, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'BUY_ITEM', templateId: 'battle_weapon' },
  { type: 'BUY_ITEM', templateId: 'shield' },
  { type: 'BUY_ITEM', templateId: 'rope' },
  { type: 'BUY_ITEM', templateId: 'torches' },
  { type: 'BUY_ITEM', templateId: 'rations' },
  equip('battle_weapon'),
  equip('shield'),
  { type: 'FINALIZE_CHARACTER' },
])

/** Thief, level 3, badly wounded, with a temporary DEX buff. */
export const wren = build('story-wren', [
  { type: 'SET_NAME', name: 'Wren Ashfoot' },
  { type: 'SET_CLASS', classId: 'thief' },
  rolls({ str: [6, 0], dex: [12, 3], con: [7, 1], int: [9, 1], wis: [8, 1], cha: [10, 2] }),
  { type: 'TOGGLE_SKILL', id: 'deception' },
  { type: 'TOGGLE_ABILITY', id: 'shadowStrike' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 6, currentHp: 6, hpHistory: [{ level: 1, roll: 5, source: 'dice' }] },
  { type: 'BUY_ITEM', templateId: 'light_weapon' },
  { type: 'BUY_ITEM', templateId: 'short_bow' },
  { type: 'BUY_ITEM', templateId: 'lockpicks' },
  equip('light_weapon'),
  { type: 'FINALIZE_CHARACTER' },
  { type: 'GAIN_XP', amount: XP_THRESHOLDS[3] + 420 },
  (c) => levelUp(c, 2, 4, { abilityIds: [...c.abilityIds, 'luck'] }),
  (c) => levelUp(c, 3, 5, { skillIds: [...c.skillIds, 'awareness'] }),
  { type: 'APPLY_DAMAGE', amount: 11 },
  { type: 'ADD_STAT_MODIFIER', statKey: 'dex', amount: 1, label: 'Cat’s grace' },
  { type: 'SET_COINS', amount: 37 },
])

/** Wizard, level 2, two bound spirits, a ritual and a quicksilver dose taken. */
export const mirel = build('story-mirel', [
  { type: 'SET_NAME', name: 'Mirel Vane' },
  { type: 'SET_CLASS', classId: 'wizard' },
  rolls({ str: [5, 0], dex: [8, 1], con: [7, 1], int: [12, 3], wis: [10, 2], cha: [6, 0] }),
  { type: 'TOGGLE_ABILITY', id: 'ritual' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 5, currentHp: 5, hpHistory: [{ level: 1, roll: 4, source: 'dice' }] },
  {
    type: 'UPDATE_MAGIC',
    magic: {
      spirits: [
        { id: 'spirit-1', name: 'Illas of the Sparks', appearance: 'A swarm of embers', sphere1: 'fire', sphere2: 'air' },
        { id: 'spirit-2', name: 'Gurn the Cold', appearance: 'Frost on a still pond', sphere1: 'ice', sphere2: 'water' },
      ],
      rituals: [{ name: 'Whisper of Stone', description: 'Ask the walls what they have witnessed.' }],
      cantrips: [],
    },
  },
  { type: 'BUY_ITEM', templateId: 'light_weapon' },
  { type: 'BUY_ITEM', templateId: 'mercury' },
  { type: 'BUY_ITEM', templateId: 'mercury' },
  { type: 'FINALIZE_CHARACTER' },
  (c) => ({ type: 'USE_ITEM', itemId: itemId(c, 'mercury') }),
  { type: 'GAIN_XP', amount: XP_THRESHOLDS[2] + 150 },
  (c) => levelUp(c, 2, 3),
])

/** Cleric, level 1, enough XP to level up. */
export const oda = build('story-oda', [
  { type: 'SET_NAME', name: 'Oda Brightwater' },
  { type: 'SET_CLASS', classId: 'cleric' },
  rolls({ str: [7, 1], dex: [6, 0], con: [9, 1], int: [8, 1], wis: [12, 3], cha: [10, 2] }),
  { type: 'TOGGLE_ABILITY', id: 'blessing' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 7, currentHp: 7, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'BUY_ITEM', templateId: 'battle_weapon' },
  { type: 'BUY_ITEM', templateId: 'bandages' },
  equip('battle_weapon'),
  { type: 'FINALIZE_CHARACTER' },
  { type: 'GAIN_XP', amount: XP_THRESHOLDS[2] + 40 },
])

/** Ranger, level 1, no gear and no coins. */
export const sage = build('story-sage', [
  { type: 'SET_NAME', name: 'Sage' },
  { type: 'SET_CLASS', classId: 'ranger' },
  rolls({ str: [9, 1], dex: [10, 2], con: [8, 1], int: [6, 0], wis: [9, 1], cha: [7, 1] }),
  { type: 'TOGGLE_ABILITY', id: 'scouting' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 7, currentHp: 7, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'SET_COINS', amount: 0 },
  { type: 'FINALIZE_CHARACTER' },
])

export const PARTY = [brann, wren, mirel, oda]

// ── Logs ───────────────────────────────────────────────────────────────────

export const ROLLS: RollRecord[] = [
  {
    id: 'roll-1', timestamp: STORY_NOW - 9 * 60_000, notation: '2d6', dice: [{ sides: 6, value: 4 }, { sides: 6, value: 6 }],
    diceTotal: 10, modifier: 2, total: 12, label: 'STR', characterId: brann.id, characterName: brann.name,
    purpose: { kind: 'stat', statKey: 'str', statBonus: 2 },
  },
  {
    id: 'roll-2', timestamp: STORY_NOW - 6 * 60_000, notation: '1d6+1', dice: [{ sides: 6, value: 5 }],
    diceTotal: 5, modifier: 1, total: 6, label: 'Damage', characterId: brann.id, characterName: brann.name,
    purpose: { kind: 'damage', weaponName: 'Battle weapon', weaponTemplateId: 'battle_weapon', formula: '1d6+1' },
  },
  {
    id: 'roll-3', timestamp: STORY_NOW - 3 * 60_000, notation: '2d6', dice: [{ sides: 6, value: 2 }, { sides: 6, value: 1 }],
    diceTotal: 3, modifier: 1, total: 4, label: 'INT', characterId: wren.id, characterName: wren.name,
    purpose: { kind: 'stat', statKey: 'int', statBonus: 1 }, rollMode: 'disadvantage',
    discardedDice: [{ sides: 6, value: 5 }, { sides: 6, value: 3 }], discardedTotal: 8,
  },
  {
    id: 'roll-4', timestamp: STORY_NOW - 60_000, notation: '2d6', dice: [{ sides: 6, value: 6 }, { sides: 6, value: 6 }],
    diceTotal: 12, modifier: 0, total: 12, label: '2d6', characterId: oda.id, characterName: oda.name,
    purpose: { kind: 'free', notation: '2d6' },
  },
]

function changesFor(char: Character, cmds: CharacterCommand[], startAt: number): ChangeEntry[] {
  let current = char
  let ts = startAt
  const entries: ChangeEntry[] = []
  for (const cmd of cmds) {
    const { character, changes } = applyCommand(current, cmd)
    current = character
    for (const change of changes) {
      ts += 45_000
      entries.push({ ...change, id: `change-${entries.length + 1}-${char.id}`, timestamp: ts, characterId: char.id, characterName: char.name })
    }
  }
  return entries
}

export const CHANGES: ChangeEntry[] = [
  ...changesFor(brann, [
    { type: 'APPLY_DAMAGE', amount: 3 },
    { type: 'GAIN_XP', amount: 120 },
    { type: 'BUY_ITEM', templateId: 'crowbar' },
  ], STORY_NOW - 8 * 60_000),
  ...changesFor(wren, [{ type: 'HEAL', amount: 2 }], STORY_NOW - 2 * 60_000),
]

// ── Games ──────────────────────────────────────────────────────────────────

/** The signed-in mock user (`signInMock()` in .storybook/mocks/pb.ts). */
export const STORY_USER = 'user-mock'

/** A game the story user runs. */
export const crookhollow: Game = { id: 'story-game-crookhollow', name: 'Shadows over Crookhollow', master: STORY_USER, inviteCode: 'K7QX29AB' }
/** A game the story user plays in; Seva is its master. */
export const olden: Game = { id: 'story-game-olden', name: 'Olden’s Tower', master: 'user-seva', inviteCode: 'M4RT8WZN' }

export const GAMES = [crookhollow, olden]

const member = (game: Game, user: string, name: string): GameMember => ({ id: `${game.id}-${user}`, game: game.id, user, name })

export const MEMBERS: GameMember[] = [
  member(crookhollow, STORY_USER, 'Anna'),
  member(crookhollow, 'user-kostya', 'Kostya'),
  member(crookhollow, 'user-yana', 'Yana'),
  member(olden, 'user-seva', 'Seva'),
  member(olden, STORY_USER, 'Anna'),
  member(olden, 'user-kostya', 'Kostya'),
]

/** The story user's own character in a game. */
export const inGame = (game: Game): CharacterMeta => ({ owner: STORY_USER, game: game.id })

/** Crookhollow's table as its master: Brann is mine, Wren is Kostya's, Mirel is Yana's. Sage stays free. */
export const CROOKHOLLOW_META: Record<string, CharacterMeta> = {
  [brann.id]: inGame(crookhollow),
  [wren.id]: { owner: 'user-kostya', game: crookhollow.id },
  [mirel.id]: { owner: 'user-yana', game: crookhollow.id },
}

/** Olden's table as a player: Oda is Seva's (the master), Wren is mine. Sage stays free. */
export const OLDEN_META: Record<string, CharacterMeta> = {
  [oda.id]: { owner: 'user-seva', game: olden.id },
  [wren.id]: inGame(olden),
}

/** Crookhollow's monster library, as its master prepared it (unsorted on purpose: the screen sorts). */
export const MONSTERS: LibraryMonster[] = [
  { id: 'story-monster-ogre', name: 'Ogre', hp: 18, armor: 1, damage: '1d10+1', special: 'Hurls whoever it hits across the room.' },
  { id: 'story-monster-goblin', name: 'Goblin', hp: 3, armor: 0, damage: '1d6', special: 'Cowardly: flees once half the pack is down.', notes: 'Three of them hide in the mill loft.' },
  { id: 'story-monster-cultist', name: 'Cultist of the Drowned God', hp: 6, armor: 1, damage: '1d6', special: 'Casts Sleep once per fight.' },
  { id: 'story-monster-wolf', name: 'Wolf', hp: 6, armor: 0, damage: '1d6', notes: 'Hunts in packs near the old road.' },
]

/** PocketBase rows of a game's monsters, for seedRecords('monsters', …). */
export const monsterRows = (game: Game, monsters: LibraryMonster[] = MONSTERS) =>
  monsters.map(m => ({ id: m.id, game: game.id, data: structuredClone(m) }))

export const ITEMS: LibraryItem[] = [
  { id: 'story-item-lantern-oil', name: 'Lantern oil', descriptor: { kind: 'gear', consumable: true }, quantity: 3, price: 2 },
  { id: 'story-item-crossbow', name: 'Hunting crossbow', descriptor: { kind: 'weapon', melee: false }, damage: '1d6', price: 30 },
  { id: 'story-item-shield', name: 'Oak shield', descriptor: { kind: 'shield' }, price: 10 },
  { id: 'story-item-sword', name: 'Longsword', descriptor: { kind: 'weapon', melee: true }, damage: '1d8', price: 40 },
  { id: 'story-item-amulet', name: 'Amulet of the Drowned God', descriptor: { kind: 'occult' }, notes: 'Cold to the touch; whispers near water.' },
  { id: 'story-item-leather', name: 'Leather jerkin', descriptor: { kind: 'armor', class: 'light' }, price: 20 },
  { id: 'story-item-map', name: 'Smuggler map', descriptor: { kind: 'custom' }, notes: 'Marks three caves along the coast.' },
]

/** PocketBase rows of a game's items, for seedRecords('items', …). */
export const itemRows = (game: Game, items: LibraryItem[] = ITEMS) =>
  items.map(i => ({ id: i.id, game: game.id, data: structuredClone(i) }))
