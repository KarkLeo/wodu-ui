# WoD Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полностью заменить механику Dungeon World на World of Dungeons в `character-sheet-v1`: новые модели данных, справочники, 3-шаговый wizard создания, новая in-game вкладочная верстка, новый level-up flow.

**Architecture:** Слой `src/types` + `src/data` + `src/utils/derived.ts` задают модель и справочники; `src/stores` хранит состояние и persists в `localStorage` под новым ключом `wod.characters.v1`; feature-папки `character-creation` / `in-game` / `level-up` потребляют данные через store и derived-утилиты.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Reka UI + Vite. Тесты в проекте не пишутся (см. `memory/feedback_no_tests.md`).

**Спецификация:** `docs/superpowers/specs/2026-04-17-wod-migration-design.md` — ссылайся на неё при вопросах по правилам.

**Подход:** Так как миграция полностью ломающая, строим снизу вверх. Шаги 1–4 создают новый фундамент (типы/данные/утилиты/stores) и полностью переписывают существующие файлы этих слоёв. Шаги 5–10 переписывают UI. Шаг 11 — финальная зачистка и верификация. TypeScript будет ругаться между шагами — это ожидаемо, финальный `npm run build` проходит только после шага 10.

---

## Phase 1: Foundation — типы, данные, утилиты

### Task 1: Новые типы персонажа

**Files:**
- Replace: `src/types/character.ts` (полная перезапись)

- [ ] **Step 1.1: Переписать `src/types/character.ts`**

```ts
export const SKILLS = [
  { id: 'athletics',  name: 'Атлетика' },
  { id: 'awareness',  name: 'Внимательность' },
  { id: 'deception',  name: 'Обман' },
  { id: 'decipher',   name: 'Расшифровка' },
  { id: 'healing',    name: 'Лечение' },
  { id: 'leadership', name: 'Лидерство' },
  { id: 'lore',       name: 'Знания' },
  { id: 'stealth',    name: 'Скрытность' },
  { id: 'survival',   name: 'Выживание' },
] as const
export type SkillId = typeof SKILLS[number]['id']

export const ABILITIES = [
  { id: 'blessing',     name: 'Благословение', description: 'Освящаешь предметы святой водой — они считаются святыми и магическими, +3 к урону против нечисти (на короткое время).' },
  { id: 'heal',         name: 'Исцеление',     description: 'Можешь нейтрализовать яды, снять проклятия или исцелить раны касанием.' },
  { id: 'turnUndead',   name: 'Отвращение нежити', description: 'Сдерживаешь нежить силой веры и святым символом.' },
  { id: 'vision',       name: 'Видение',       description: 'Выпей святую воду, чтобы услышать наставления своего божества.' },
  { id: 'sturdy',       name: 'Стойкость',     description: '+6 ОЗ.' },
  { id: 'skirmish',     name: 'Манёвренность', description: '+1 к урону, надетый доспех считается на класс легче.' },
  { id: 'hewing',       name: 'Рубка',         description: '+2 к урону в ближнем бою.' },
  { id: 'toughness',    name: 'Прочность',     description: '+1 к броне.' },
  { id: 'shadowStrike', name: 'Удар из тени',  description: 'Атака из укрытия даёт +3 к урону.' },
  { id: 'luck',         name: 'Удача',         description: 'Раз в день можешь превратить промах в частичный успех.' },
  { id: 'reflexes',     name: 'Реакция',       description: 'Ты всегда действуешь первым и можешь реагировать при внезапном нападении.' },
  { id: 'skilled',      name: 'Умелец',        description: 'Можешь быстро вскрыть замок, срезать кошелёк или обезвредить ловушку.' },
  { id: 'incantations', name: 'Заклички',      description: 'Знаешь три простых заклинания: Свеча, Тень, Чревовещание.' },
  { id: 'domination',   name: 'Подчинение',    description: 'Можешь попытаться подчинить любого духа, демона и т.д.' },
  { id: 'ritual',       name: 'Ритуал',        description: 'Можешь проводить оккультные ритуалы (из фолиантов и свитков); начинаешь с двумя известными ритуалами.' },
  { id: 'summoning',    name: 'Призыв',        description: 'Можешь призывать известных тебе духов (см. правила магии).' },
  { id: 'pet',          name: 'Питомец',       description: 'У тебя есть верный и умелый животный компаньон.' },
  { id: 'scouting',     name: 'Разведка',      description: 'Когда ведёшь разведку — всегда замечаешь цель прежде, чем она заметит тебя.' },
  { id: 'volley',       name: 'Залп',          description: '+2 к урону дальнего боя.' },
  { id: 'savage',       name: 'Дикарь',        description: 'Можешь разговаривать с животными и пытаться ими командовать.' },
] as const
export type AbilityId = typeof ABILITIES[number]['id']

export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>

export type ArmorType = 'none' | 'light' | 'full'
export interface ArmorState { type: ArmorType; shield: boolean }

export interface InventoryItem {
  id: string
  name: string
  price?: number
  tags: string[]
  damage?: string
  notes?: string
}

export interface Spirit {
  id: string
  name: string
  appearance: string
  sphere1: string
  sphere2: string
}

export interface Magic {
  spirits: Spirit[]
  rituals: string[]
  cantrips: string[]
}

export type CharacterStatus = 'draft' | 'active'
export type ClassId = 'fighter' | 'thief' | 'cleric' | 'wizard' | 'ranger'

export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  name: string
  trueName?: string
  classId: ClassId
  level: number
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number
  currentHp: number
  maxHp: number

  skillIds: SkillId[]
  abilityIds: AbilityId[]

  armor: ArmorState
  inventory: InventoryItem[]
  coins: number

  magic?: Magic

  damageBonusDice: number
  notes: string
}

export interface ClassData {
  id: ClassId
  name: string
  grantedSkillIds: SkillId[]
  abilityPool: AbilityId[]
  autoAbilityIds?: AbilityId[]
  hasMagic: boolean
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/types/character.ts
git commit -m "feat(types): rewrite character types for World of Dungeons"
```

---

### Task 2: Справочник классов, снаряжения, сфер, XP-таблицы

**Files:**
- Create: `src/data/classes.ts`
- Create: `src/data/gear.ts`
- Create: `src/data/spheres.ts`
- Create: `src/data/xpTable.ts`
- Delete (в конце задачи): `src/data/classes/` (папка целиком, включая `fighter.ts`)

- [ ] **Step 2.1: Создать `src/data/classes.ts`**

```ts
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
```

- [ ] **Step 2.2: Создать `src/data/gear.ts`**

```ts
import type { InventoryItem } from '@/types/character'

export type GearTemplate = Omit<InventoryItem, 'id'> & { templateId: string }

export const GEAR_CATEGORIES = [
  { id: 'weapon', name: 'Оружие' },
  { id: 'armor',  name: 'Доспехи и щиты' },
  { id: 'gear',   name: 'Походное снаряжение' },
  { id: 'tool',   name: 'Инструменты' },
  { id: 'occult', name: 'Оккультные предметы' },
  { id: 'rare',   name: 'Редкие предметы' },
  { id: 'fire',   name: 'Огненное масло' },
] as const

export const GEAR_CATALOG: GearTemplate[] = [
  // Оружие
  { templateId: 'light_weapon',  name: 'Лёгкое оружие',  price: 10, tags: ['weapon', 'light'],   damage: 'd6',   notes: 'Кинжалы, короткие мечи, ручные топоры. Как доп. оружие — 1 раз за атаку перебросить урон.' },
  { templateId: 'battle_weapon', name: 'Боевое оружие',  price: 30, tags: ['weapon', 'battle'],  damage: 'd6+1', notes: 'Длинные мечи, молоты, топоры, копья.' },
  { templateId: 'heavy_weapon',  name: 'Тяжёлое оружие', price: 40, tags: ['weapon', 'heavy', 'two-handed'], damage: 'd6+2', notes: 'Двуручные мечи, боевые топоры, древковое оружие.' },
  { templateId: 'short_bow',     name: 'Короткий лук',   price: 10, tags: ['weapon', 'ranged', 'light'],  damage: 'd6',   notes: 'Пращи и т.п.' },
  { templateId: 'bow',           name: 'Лук',            price: 30, tags: ['weapon', 'ranged', 'battle'], damage: 'd6+1', notes: 'Арбалеты, пистолеты и т.п.' },
  { templateId: 'heavy_bow',     name: 'Тяжёлый лук / огнестрел', price: 50, tags: ['weapon', 'ranged', 'heavy'], damage: 'd6+2', notes: 'С места. Арбалеты и мушкеты.' },
  // Доспехи
  { templateId: 'light_armor', name: 'Лёгкий доспех', price: 30, tags: ['armor', 'light'], notes: 'Броня 1.' },
  { templateId: 'full_armor',  name: 'Полный доспех', price: 60, tags: ['armor', 'full'],  notes: 'Броня 2. Всегда со шлемом. Мешает бегать, скрываться, плавать.' },
  { templateId: 'shield',      name: 'Щит',           price: 10, tags: ['armor', 'shield'], notes: '+1 к броне.' },
  // Походное (2с)
  { templateId: 'rope',    name: 'Верёвка 6м',       price: 2, tags: ['gear'] },
  { templateId: 'spike',   name: 'Железный клин',    price: 2, tags: ['gear'] },
  { templateId: 'chalk',   name: 'Мел',              price: 2, tags: ['gear'] },
  { templateId: 'parchment', name: 'Пергамент',      price: 2, tags: ['gear'] },
  { templateId: 'flint',   name: 'Кремень и огниво', price: 2, tags: ['gear'] },
  { templateId: 'torches', name: 'Факелы (4 шт.)',   price: 2, tags: ['gear'] },
  { templateId: 'tent',    name: 'Палатка',          price: 2, tags: ['gear'] },
  { templateId: 'dice',    name: 'Кости',            price: 2, tags: ['gear'] },
  { templateId: 'caltrops', name: 'Шипы',            price: 2, tags: ['gear'], notes: 'Замедляют преследователей.' },
  { templateId: 'bandages', name: 'Бинты',           price: 2, tags: ['gear'] },
  { templateId: 'rations', name: 'Дорожный паёк',    price: 2, tags: ['gear', 'consumable'] },
  { templateId: 'waterskin', name: 'Бурдюк с водой', price: 2, tags: ['gear', 'consumable'] },
  { templateId: 'wineskin', name: 'Бурдюк с вином',  price: 2, tags: ['gear', 'consumable'] },
  // Инструменты (5с)
  { templateId: 'crowbar',    name: 'Лом',              price: 5, tags: ['tool'] },
  { templateId: 'hatchet',    name: 'Топорик',          price: 5, tags: ['tool'] },
  { templateId: 'snare',      name: 'Капкан',           price: 5, tags: ['tool'] },
  { templateId: 'lockpicks',  name: 'Отмычки',          price: 5, tags: ['tool'] },
  { templateId: 'ink',        name: 'Перо и чернила',   price: 5, tags: ['tool'] },
  { templateId: 'fishingrod', name: 'Удочка',           price: 5, tags: ['tool'] },
  { templateId: 'shovel',     name: 'Лопата',           price: 5, tags: ['tool'] },
  { templateId: 'grapnel',    name: 'Кошка с верёвкой', price: 5, tags: ['tool'] },
  { templateId: 'pick',       name: 'Кирка',            price: 5, tags: ['tool'] },
  { templateId: 'pole',       name: 'Складной шест',    price: 5, tags: ['tool'] },
  // Оккультные (10с)
  { templateId: 'mercury',      name: 'Ртуть (доза)',         price: 10, tags: ['occult', 'consumable'], notes: 'Слабый яд и наркотик. Больше доз в день, чем уровень — бросок ТЕЛ против эффектов.' },
  { templateId: 'bonedust',     name: 'Мешочек с костной пылью', price: 10, tags: ['occult'] },
  { templateId: 'holywater',    name: 'Пузырёк святой воды',  price: 10, tags: ['occult', 'consumable'] },
  { templateId: 'bloodvial',    name: 'Пузырёк крови',        price: 10, tags: ['occult', 'consumable'] },
  { templateId: 'incense',      name: 'Благовония и масла',   price: 10, tags: ['occult'] },
  // Редкие (20с)
  { templateId: 'mirror',    name: 'Зеркало',        price: 20, tags: ['rare'] },
  { templateId: 'lantern',   name: 'Фонарь',         price: 20, tags: ['rare'] },
  { templateId: 'spyglass',  name: 'Подзорная труба', price: 20, tags: ['rare'] },
  { templateId: 'hourglass', name: 'Песочные часы',  price: 20, tags: ['rare'] },
  { templateId: 'boardgame', name: 'Настольная игра', price: 20, tags: ['rare'] },
  { templateId: 'finery',    name: 'Изысканная одежда', price: 20, tags: ['rare'] },
  { templateId: 'symbols',   name: 'Священные символы и обереги', price: 20, tags: ['rare'] },
  // Огненное масло
  { templateId: 'fireoil', name: 'Огненное масло (фляжка)', price: 20, tags: ['fire', 'consumable'], notes: 'Поджигает область: d6+1 урона/раунд 3 раунда. Фонарь — 10 заправок.' },
]

export function findGearTemplate(templateId: string): GearTemplate | undefined {
  return GEAR_CATALOG.find(g => g.templateId === templateId)
}
```

- [ ] **Step 2.3: Создать `src/data/spheres.ts`**

```ts
export const SPHERE_PRESETS = [
  'Огонь',
  'Тень',
  'Камень',
  'Молния',
  'Тайны',
  'Страх',
] as const

export type SpherePreset = typeof SPHERE_PRESETS[number]
```

- [ ] **Step 2.4: Создать `src/data/xpTable.ts`**

```ts
import type { StatKey } from '@/types/character'

export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 1000,
  3: 3000,
  4: 6000,
  5: 10000,
  6: 15000,
  7: 21000,
  8: 28000,
  9: 36000,
  10: 45000,
}

export interface LevelReward {
  level: number
  hitDice?: number
  skills?: number
  abilities?: number
  statBonus?: number
  damageDice?: number
}

export const LEVEL_REWARDS: LevelReward[] = [
  { level: 2,  hitDice: 1 },
  { level: 3,  skills: 1, abilities: 1 },
  { level: 4,  hitDice: 1, statBonus: 1 },
  { level: 5,  damageDice: 1 },
  { level: 6,  hitDice: 1, skills: 1, abilities: 1 },
  { level: 7,  statBonus: 1 },
  { level: 8,  hitDice: 1 },
  { level: 9,  skills: 1, abilities: 1 },
  { level: 10, hitDice: 1, statBonus: 1, damageDice: 1 },
]

export function getReward(level: number): LevelReward | undefined {
  return LEVEL_REWARDS.find(r => r.level === level)
}

export const MAX_STAT_BONUS = 3
export const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const STAT_LABELS: Record<StatKey, string> = {
  str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР',
}
```

- [ ] **Step 2.5: Удалить старую папку `src/data/classes/`**

```bash
rm -rf src/data/classes
```

- [ ] **Step 2.6: Commit**

```bash
git add src/data/ 
git rm -rf src/data/classes 2>/dev/null || true
git commit -m "feat(data): add WoD classes, gear catalog, spheres, XP table"
```

---

### Task 3: Derived-утилиты и удаление старых

**Files:**
- Create: `src/utils/derived.ts`
- Delete: `src/utils/character.ts`
- Delete: `src/utils/character.test.ts`
- Delete: `src/utils/format.ts`

- [ ] **Step 3.1: Создать `src/utils/derived.ts`**

```ts
import type { ArmorState, Character, InventoryItem, StatKey } from '@/types/character'
import { XP_THRESHOLDS } from '@/data/xpTable'

export function totalArmor(char: Pick<Character, 'armor' | 'abilityIds'>): number {
  const base = char.armor.type === 'full' ? 2 : char.armor.type === 'light' ? 1 : 0
  const shield = char.armor.shield ? 1 : 0
  const toughness = char.abilityIds.includes('toughness') ? 1 : 0
  return base + shield + toughness
}

export function armorLabel(armor: ArmorState): string {
  const base = armor.type === 'full' ? 'Полный' : armor.type === 'light' ? 'Лёгкий' : 'Без доспеха'
  return armor.shield ? `${base} + щит` : base
}

export function isWeapon(item: InventoryItem): boolean {
  return item.tags.includes('weapon')
}

export function damageFormula(char: Pick<Character, 'abilityIds' | 'damageBonusDice'>, weapon: InventoryItem): string {
  if (!weapon.damage) return '—'
  const bonuses: string[] = []
  const melee = weapon.tags.includes('weapon') && !weapon.tags.includes('ranged')
  const ranged = weapon.tags.includes('ranged')
  if (char.abilityIds.includes('skirmish')) bonuses.push('+1 Манёвр.')
  if (melee && char.abilityIds.includes('hewing')) bonuses.push('+2 Рубка')
  if (ranged && char.abilityIds.includes('volley')) bonuses.push('+2 Залп')
  const bonusDice = char.damageBonusDice > 0 ? ` +${char.damageBonusDice}d6` : ''
  const extras = bonuses.length ? ' (' + bonuses.join(', ') + ')' : ''
  return `${weapon.damage}${bonusDice}${extras}`
}

export function xpToNextLevel(char: Pick<Character, 'level' | 'xp'>): number | null {
  if (char.level >= 10) return null
  const next = XP_THRESHOLDS[char.level + 1]
  return Math.max(0, next - char.xp)
}

export function xpProgressPercent(char: Pick<Character, 'level' | 'xp'>): number {
  if (char.level >= 10) return 100
  const current = XP_THRESHOLDS[char.level]
  const next = XP_THRESHOLDS[char.level + 1]
  const span = next - current
  return Math.max(0, Math.min(100, ((char.xp - current) / span) * 100))
}

export function isReadyToLevelUp(char: Pick<Character, 'level' | 'xp'>): boolean {
  if (char.level >= 10) return false
  return char.xp >= XP_THRESHOLDS[char.level + 1]
}

export function hitDiceCount(con: number): number {
  return 1 + Math.max(0, con)
}

export function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6)
}

export function roll2d6(): number {
  return rollD6() + rollD6()
}

export function statBonusFrom2d6(roll: number): number {
  if (roll <= 6) return 0
  if (roll <= 9) return 1
  if (roll <= 11) return 2
  return 3
}

/** Бросает N d6, возвращает отсортированный массив (убывание) и top `level` значений. */
export function rollHitDice(numDice: number, level: number): { rolls: number[]; kept: number[]; total: number } {
  const rolls = Array.from({ length: numDice }, () => rollD6()).sort((a, b) => b - a)
  const kept = rolls.slice(0, level)
  const total = kept.reduce((a, b) => a + b, 0)
  return { rolls, kept, total }
}

export const STAT_ORDER: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
```

- [ ] **Step 3.2: Удалить старые утилиты**

```bash
rm src/utils/character.ts src/utils/character.test.ts src/utils/format.ts
```

- [ ] **Step 3.3: Commit**

```bash
git add src/utils/derived.ts
git rm src/utils/character.ts src/utils/character.test.ts src/utils/format.ts
git commit -m "feat(utils): add derived helpers for WoD; remove DW utils"
```

---

## Phase 2: Stores

### Task 4: Переписать `characters` store

**Files:**
- Replace: `src/stores/characters.ts`
- Delete: `src/stores/characters.test.ts`

- [ ] **Step 4.1: Переписать `src/stores/characters.ts`**

```ts
import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'

const STORAGE_KEY = 'wod.characters.v1'

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
    activeId: null as string | null,
  }),
  getters: {
    active(state): Character | undefined {
      return state.activeId ? state.list.find(c => c.id === state.activeId) : undefined
    },
    getById: (state) => (id: string) => state.list.find(c => c.id === id),
    isReadyToLevelUp: () => (char: Character) => isReadyToLevelUp(char),
  },
  actions: {
    add(data: Omit<Character, 'id' | 'createdAt'>): Character {
      const character: Character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      this.list.push(character)
      return character
    },
    update(id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>) {
      const idx = this.list.findIndex(c => c.id === id)
      if (idx !== -1) this.list[idx] = { ...this.list[idx], ...patch }
    },
    remove(id: string) {
      this.list = this.list.filter(c => c.id !== id)
      if (this.activeId === id) this.activeId = null
    },
    setActive(id: string | null) {
      this.activeId = id
    },
    applyLevelUp(id: string, patch: Partial<Character>) {
      this.update(id, patch)
    },
  },
  persist: {
    key: STORAGE_KEY,
  },
})
```

Примечание: pinia-plugin-persistedstate хранит под ключом `wod.characters.v1`. Старый ключ `characters` из DW автоматически игнорируется (плагин читает только свой ключ).

- [ ] **Step 4.2: Удалить тест**

```bash
rm src/stores/characters.test.ts
```

- [ ] **Step 4.3: Commit**

```bash
git add src/stores/characters.ts
git rm src/stores/characters.test.ts
git commit -m "feat(stores): rewrite characters store for WoD"
```

---

### Task 5: Переписать `creation` store

**Files:**
- Replace: `src/stores/creation.ts`
- Delete: `src/stores/creation.test.ts`

- [ ] **Step 5.1: Переписать `src/stores/creation.ts`**

```ts
import { defineStore } from 'pinia'

export const useCreationStore = defineStore('creation', {
  state: () => ({
    draftId: null as string | null,
    step: 1 as 1 | 2 | 3,
  }),
  actions: {
    setDraft(id: string) {
      this.draftId = id
    },
    setStep(n: 1 | 2 | 3) {
      this.step = n
    },
    nextStep() {
      if (this.step < 3) this.step = (this.step + 1) as 1 | 2 | 3
    },
    prevStep() {
      if (this.step > 1) this.step = (this.step - 1) as 1 | 2 | 3
    },
    reset() {
      this.draftId = null
      this.step = 1
    },
  },
  persist: {
    key: 'wod.creation.v1',
  },
})
```

- [ ] **Step 5.2: Удалить тест**

```bash
rm src/stores/creation.test.ts
```

- [ ] **Step 5.3: Commit**

```bash
git add src/stores/creation.ts
git rm src/stores/creation.test.ts
git commit -m "feat(stores): rewrite creation store for 3-step wizard"
```

---

## Phase 3: Character list view

### Task 6: Обновить `CharacterListView`

**Files:**
- Modify: `src/features/character-list/CharacterListView.vue`

- [ ] **Step 6.1: Заменить отображение класса на использование справочника**

Open `src/features/character-list/CharacterListView.vue`. Импортируй `CLASSES`:

```ts
import { CLASSES } from '@/data/classes'
```

Замени строку `<div class="label">{{ char.classId === 'fighter' ? 'Воин' : char.classId }} · Уровень {{ char.level }}</div>` на:

```html
<div class="label">{{ CLASSES[char.classId]?.name ?? char.classId }} · Уровень {{ char.level }}</div>
```

Остальное в файле не трогаем — `name`, `currentHp`, `maxHp`, `status`, `level` существуют в новой модели.

- [ ] **Step 6.2: Commit**

```bash
git add src/features/character-list/CharacterListView.vue
git commit -m "refactor(list): use CLASSES dict for class name"
```

---

## Phase 4: Creation wizard (3 шага)

### Task 7: `CharacterCreationView` + StepIdentity

**Files:**
- Replace: `src/features/character-creation/CharacterCreationView.vue`
- Replace: `src/features/character-creation/steps/StepIdentity.vue`
- Delete: `src/features/character-creation/steps/StepStats.vue` (его функциональность переходит в StepIdentity)
- Delete: `src/features/character-creation/steps/StepMoves.vue`

- [ ] **Step 7.1: Переписать `CharacterCreationView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import StepIdentity from './steps/StepIdentity.vue'
import StepTraining from './steps/StepTraining.vue'
import StepGear from './steps/StepGear.vue'
import type { Character } from '@/types/character'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

onMounted(() => {
  if (!creation.draftId) {
    const draft = characters.add({
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
      skillIds: [],
      abilityIds: [],
      armor: { type: 'none', shield: false },
      inventory: [],
      coins: 60,
      damageBonusDice: 0,
      notes: '',
    })
    creation.setDraft(draft.id)
  }
})

const draft = computed(() => (creation.draftId ? characters.getById(creation.draftId) : undefined))

const stepComponents = [StepIdentity, StepTraining, StepGear]
const currentStepComponent = computed(() => stepComponents[creation.step - 1])

function patch(data: Partial<Character>) {
  if (creation.draftId) characters.update(creation.draftId, data)
}

function next() {
  creation.nextStep()
}

function back() {
  if (creation.step === 1) {
    if (creation.draftId) characters.remove(creation.draftId)
    creation.reset()
    router.push('/')
  } else {
    creation.prevStep()
  }
}

function finish() {
  if (!creation.draftId) return
  characters.update(creation.draftId, { status: 'active' })
  characters.setActive(creation.draftId)
  const id = creation.draftId
  creation.reset()
  router.push(`/character/${id}`)
}
</script>

<template>
  <div class="content-wrap" v-if="draft">
    <div class="progress-bar">
      <div
        v-for="n in 3"
        :key="n"
        class="progress-bar__segment"
        :class="{ 'progress-bar__segment--done': n <= creation.step }"
      />
    </div>
    <div class="creation-header">
      <button class="btn-ghost" @click="back">← Назад</button>
      <span class="label">Шаг {{ creation.step }} из 3</span>
    </div>
    <component
      :is="currentStepComponent"
      :draft="draft"
      @patch="patch"
      @next="next"
      @finish="finish"
    />
  </div>
</template>

<style scoped>
.progress-bar { display: flex; height: 3px; background: var(--color-bg-dark); }
.progress-bar__segment { flex: 1; background: var(--color-border); opacity: 0.3; transition: opacity 0.2s; }
.progress-bar__segment--done { opacity: 1; }
.creation-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--color-border); }
</style>
```

- [ ] **Step 7.2: Создать `src/features/character-creation/steps/StepIdentity.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, ClassId, StatKey } from '@/types/character'
import { CLASS_LIST } from '@/data/classes'
import { STAT_KEYS, STAT_LABELS } from '@/data/xpTable'
import { roll2d6, statBonusFrom2d6 } from '@/utils/derived'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>]; next: [] }>()

const rolled = ref(Object.values(props.draft.statRolls).some(v => v > 0))

function rollAll() {
  const rolls: Record<StatKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  const stats: Record<StatKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  for (const key of STAT_KEYS) {
    const r = roll2d6()
    rolls[key] = r
    stats[key] = statBonusFrom2d6(r)
  }
  emit('patch', { statRolls: rolls, stats })
  rolled.value = true
}

function rerollOne(key: StatKey) {
  const r = roll2d6()
  emit('patch', {
    statRolls: { ...props.draft.statRolls, [key]: r },
    stats: { ...props.draft.stats, [key]: statBonusFrom2d6(r) },
  })
}

function setStatManual(key: StatKey, value: number) {
  const v = Math.max(0, Math.min(3, value))
  emit('patch', { stats: { ...props.draft.stats, [key]: v } })
}

function selectClass(id: ClassId) {
  emit('patch', { classId: id })
}

const canContinue = computed(() =>
  props.draft.name.trim().length > 0 && rolled.value,
)
</script>

<template>
  <div class="step">
    <section class="block">
      <label class="label">Имя</label>
      <input
        class="input"
        :value="draft.name"
        @input="emit('patch', { name: ($event.target as HTMLInputElement).value })"
        placeholder="Имя персонажа"
      />
      <label class="label">Истинное имя (опционально)</label>
      <input
        class="input"
        :value="draft.trueName ?? ''"
        @input="emit('patch', { trueName: ($event.target as HTMLInputElement).value })"
        placeholder="Имя, дающее силу"
      />
    </section>

    <section class="block">
      <div class="label">Класс</div>
      <div class="class-grid">
        <button
          v-for="cls in CLASS_LIST"
          :key="cls.id"
          class="class-card"
          :class="{ 'class-card--active': draft.classId === cls.id }"
          @click="selectClass(cls.id)"
        >
          {{ cls.name }}
        </button>
      </div>
    </section>

    <section class="block">
      <div class="block-header">
        <span class="label">Характеристики</span>
        <button class="btn-ghost" @click="rollAll">Бросить все 2d6</button>
      </div>
      <div class="stats">
        <div v-for="key in STAT_KEYS" :key="key" class="stat">
          <div class="stat__head">
            <span class="stat__name">{{ STAT_LABELS[key] }}</span>
            <button class="btn-mini" @click="rerollOne(key)" title="Перебросить">🎲</button>
          </div>
          <div class="stat__roll">Бросок: {{ draft.statRolls[key] || '—' }}</div>
          <input
            type="number"
            class="input stat__input"
            :value="draft.stats[key]"
            min="0"
            max="3"
            @input="setStatManual(key, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </section>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canContinue" @click="emit('next')">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.block-header { display: flex; justify-content: space-between; align-items: center; }
.input { width: 100%; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 15px; border-radius: 4px; }
.class-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.class-card { padding: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; cursor: pointer; border-radius: 4px; }
.class-card--active { border-color: var(--color-accent); color: var(--color-accent); }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.stat { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.stat__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.stat__name { font-weight: 600; }
.stat__roll { font-size: 12px; color: var(--color-text-muted); margin-bottom: 6px; }
.stat__input { text-align: center; }
.btn-mini { background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; color: inherit; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 7.3: Удалить старые шаги**

```bash
rm src/features/character-creation/steps/StepStats.vue
rm src/features/character-creation/steps/StepMoves.vue
```

- [ ] **Step 7.4: Commit**

```bash
git add src/features/character-creation/CharacterCreationView.vue src/features/character-creation/steps/StepIdentity.vue
git rm src/features/character-creation/steps/StepStats.vue src/features/character-creation/steps/StepMoves.vue
git commit -m "feat(creation): 3-step wizard with new StepIdentity"
```

---

### Task 8: StepTraining — навыки, способности, магия

**Files:**
- Create: `src/features/character-creation/steps/StepTraining.vue`

- [ ] **Step 8.1: Создать `StepTraining.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character, SkillId, AbilityId, Spirit, Magic } from '@/types/character'
import { SKILLS, ABILITIES } from '@/types/character'
import { CLASSES } from '@/data/classes'
import { SPHERE_PRESETS } from '@/data/spheres'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>]; next: [] }>()

const classData = computed(() => CLASSES[props.draft.classId])

const autoSkills = computed<SkillId[]>(() => classData.value.grantedSkillIds)
const autoAbilities = computed<AbilityId[]>(() => classData.value.autoAbilityIds ?? [])
const requiredAbilityPicks = computed(() => 2 - autoAbilities.value.length)
const abilityPool = computed<AbilityId[]>(() => classData.value.abilityPool)

const pickedSkills = computed(() =>
  props.draft.skillIds.filter(id => !autoSkills.value.includes(id)),
)
const pickedAbilities = computed(() =>
  props.draft.abilityIds.filter(id => !autoAbilities.value.includes(id)),
)

function toggleSkill(id: SkillId) {
  if (autoSkills.value.includes(id)) return
  const has = props.draft.skillIds.includes(id)
  let next: SkillId[]
  if (has) {
    next = props.draft.skillIds.filter(x => x !== id)
  } else {
    // сохраняем только 1 дополнительный навык
    next = [...autoSkills.value, id]
  }
  emit('patch', { skillIds: next })
}

function toggleAbility(id: AbilityId) {
  if (autoAbilities.value.includes(id)) return
  if (!abilityPool.value.includes(id)) return
  const has = props.draft.abilityIds.includes(id)
  let nextPicked: AbilityId[]
  if (has) {
    nextPicked = pickedAbilities.value.filter(x => x !== id)
  } else {
    nextPicked = [...pickedAbilities.value, id]
    if (nextPicked.length > requiredAbilityPicks.value) {
      nextPicked = nextPicked.slice(nextPicked.length - requiredAbilityPicks.value)
    }
  }
  emit('patch', { abilityIds: [...autoAbilities.value, ...nextPicked] })
}

// Гарантируем что автоспособности/навыки всегда присутствуют (если сменили класс)
function syncAutos() {
  const skills = Array.from(new Set([...autoSkills.value, ...pickedSkills.value]))
  const abilities = Array.from(new Set([...autoAbilities.value, ...pickedAbilities.value.filter(a => abilityPool.value.includes(a))]))
  emit('patch', { skillIds: skills, abilityIds: abilities })
}

// Инициализация магии для волшебника
function ensureMagic(): Magic {
  if (props.draft.magic) return props.draft.magic
  const spirits: Spirit[] = [
    { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
    { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' },
  ]
  return { spirits, rituals: [], cantrips: [] }
}

function updateSpirit(idx: number, patchSp: Partial<Spirit>) {
  const magic = ensureMagic()
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patchSp } : s))
  emit('patch', { magic: { ...magic, spirits } })
}

function updateRitual(idx: number, value: string) {
  const magic = ensureMagic()
  const rituals = [...(magic.rituals ?? [])]
  while (rituals.length < 2) rituals.push('')
  rituals[idx] = value
  emit('patch', { magic: { ...magic, rituals } })
}

const showMagic = computed(() => props.draft.classId === 'wizard')
const hasIncantations = computed(() => pickedAbilities.value.includes('incantations'))
const hasRitual = computed(() => pickedAbilities.value.includes('ritual'))

const canContinue = computed(() => {
  if (pickedSkills.value.length !== 1) return false
  if (pickedAbilities.value.length !== requiredAbilityPicks.value) return false
  if (showMagic.value) {
    const magic = props.draft.magic
    if (!magic || magic.spirits.length < 2) return false
    for (const s of magic.spirits) {
      if (!s.name.trim() || !s.appearance.trim() || !s.sphere1.trim() || !s.sphere2.trim()) return false
    }
    if (hasRitual.value) {
      const rituals = magic.rituals ?? []
      if (rituals.filter(r => r.trim()).length < 2) return false
    }
  }
  return true
})

// синхронизируем авто-навыки и авто-способности при монтировании
syncAutos()

// если выбраны заклички — заполнить cantrips автоматически
if (hasIncantations.value) {
  const magic = ensureMagic()
  if (!magic.cantrips?.length) {
    emit('patch', { magic: { ...magic, cantrips: ['Свеча', 'Тень', 'Чревовещание'] } })
  }
}
</script>

<template>
  <div class="step">
    <section class="block">
      <div class="label">Навыки</div>
      <p class="hint">Автоматические — от класса. Выбери ровно 1 дополнительный.</p>
      <div class="checklist">
        <label
          v-for="sk in SKILLS"
          :key="sk.id"
          class="check"
          :class="{ 'check--auto': autoSkills.includes(sk.id), 'check--picked': draft.skillIds.includes(sk.id) }"
        >
          <input
            type="checkbox"
            :checked="draft.skillIds.includes(sk.id)"
            :disabled="autoSkills.includes(sk.id)"
            @change="toggleSkill(sk.id)"
          />
          {{ sk.name }}
        </label>
      </div>
    </section>

    <section class="block">
      <div class="label">Способности</div>
      <p class="hint">
        Выбери {{ requiredAbilityPicks }} из {{ abilityPool.length }} доступных класса.
        <span v-if="autoAbilities.length">Автоматически: {{ autoAbilities.map(id => ABILITIES.find(a => a.id === id)?.name).join(', ') }}.</span>
      </p>
      <div class="checklist">
        <label
          v-for="ab in ABILITIES"
          :key="ab.id"
          class="check"
          :class="{
            'check--auto': autoAbilities.includes(ab.id),
            'check--disabled': !autoAbilities.includes(ab.id) && !abilityPool.includes(ab.id),
            'check--picked': draft.abilityIds.includes(ab.id),
          }"
          :title="ab.description"
        >
          <input
            type="checkbox"
            :checked="draft.abilityIds.includes(ab.id)"
            :disabled="autoAbilities.includes(ab.id) || !abilityPool.includes(ab.id)"
            @change="toggleAbility(ab.id)"
          />
          <span class="check__main">
            <span class="check__name">{{ ab.name }}</span>
            <span class="check__desc">{{ ab.description }}</span>
          </span>
        </label>
      </div>
    </section>

    <section v-if="showMagic" class="block">
      <div class="label">Магия</div>
      <p class="hint">Волшебник начинает с двумя известными духами.</p>
      <div v-for="(sp, idx) in (draft.magic?.spirits ?? [])" :key="sp.id" class="spirit">
        <div class="label">Дух {{ idx + 1 }}</div>
        <input class="input" placeholder="Имя" :value="sp.name" @input="updateSpirit(idx, { name: ($event.target as HTMLInputElement).value })" />
        <input class="input" placeholder="Облик" :value="sp.appearance" @input="updateSpirit(idx, { appearance: ($event.target as HTMLInputElement).value })" />
        <div class="spirit__spheres">
          <label class="sphere">
            <span>Сфера 1</span>
            <input class="input" list="sphere-presets" :value="sp.sphere1" @input="updateSpirit(idx, { sphere1: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="sphere">
            <span>Сфера 2</span>
            <input class="input" list="sphere-presets" :value="sp.sphere2" @input="updateSpirit(idx, { sphere2: ($event.target as HTMLInputElement).value })" />
          </label>
        </div>
      </div>
      <datalist id="sphere-presets">
        <option v-for="s in SPHERE_PRESETS" :key="s" :value="s" />
      </datalist>

      <div v-if="hasRitual" class="rituals">
        <div class="label">Стартовые ритуалы (2)</div>
        <input
          v-for="i in 2"
          :key="i"
          class="input"
          :placeholder="`Ритуал ${i}`"
          :value="(draft.magic?.rituals ?? [])[i - 1] ?? ''"
          @input="updateRitual(i - 1, ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div v-if="hasIncantations" class="cantrips">
        <div class="label">Заклички</div>
        <p class="hint">Свеча · Тень · Чревовещание</p>
      </div>
    </section>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canContinue" @click="emit('next')">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.hint { font-size: 12px; color: var(--color-text-muted); margin: 0; }
.checklist { display: flex; flex-direction: column; gap: 4px; }
.check { display: flex; align-items: flex-start; gap: 8px; padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; }
.check--auto { opacity: 0.7; cursor: default; }
.check--disabled { opacity: 0.3; cursor: not-allowed; }
.check--picked { border-color: var(--color-accent); }
.check__main { display: flex; flex-direction: column; gap: 2px; }
.check__name { font-weight: 600; }
.check__desc { font-size: 12px; color: var(--color-text-muted); }
.spirit { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 10px; }
.spirit__spheres { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sphere { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--color-text-muted); }
.input { width: 100%; padding: 8px; background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 14px; border-radius: 4px; }
.rituals, .cantrips { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 8.2: Commit**

```bash
git add src/features/character-creation/steps/StepTraining.vue
git commit -m "feat(creation): add StepTraining for skills, abilities, magic"
```

---

### Task 9: StepGear — ОЗ, доспех, каталог снаряжения

**Files:**
- Replace: `src/features/character-creation/steps/StepGear.vue`

- [ ] **Step 9.1: Переписать `StepGear.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, InventoryItem, ArmorType } from '@/types/character'
import { GEAR_CATALOG, GEAR_CATEGORIES, findGearTemplate } from '@/data/gear'
import { hitDiceCount, rollHitDice } from '@/utils/derived'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>]; finish: [] }>()

const hpRolled = computed(() => props.draft.maxHp > 0)

function rollHp() {
  const numDice = hitDiceCount(props.draft.stats.con)
  const { total } = rollHitDice(numDice, props.draft.level)
  emit('patch', { hitDice: numDice, maxHp: total, currentHp: total })
}

function setArmor(type: ArmorType) {
  emit('patch', { armor: { ...props.draft.armor, type } })
}
function toggleShield() {
  emit('patch', { armor: { ...props.draft.armor, shield: !props.draft.armor.shield } })
}

function addFromCatalog(templateId: string) {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return
  if ((tpl.price ?? 0) > props.draft.coins) return
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: tpl.name,
    price: tpl.price,
    tags: [...tpl.tags],
    damage: tpl.damage,
    notes: tpl.notes,
  }
  emit('patch', {
    inventory: [...props.draft.inventory, item],
    coins: props.draft.coins - (tpl.price ?? 0),
  })
}

function removeItem(id: string) {
  const item = props.draft.inventory.find(i => i.id === id)
  if (!item) return
  emit('patch', {
    inventory: props.draft.inventory.filter(i => i.id !== id),
    coins: props.draft.coins + (item.price ?? 0),
  })
}

const customName = ref('')
const customPrice = ref(0)
function addCustom() {
  if (!customName.value.trim()) return
  if (customPrice.value > props.draft.coins) return
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: customName.value.trim(),
    price: customPrice.value || undefined,
    tags: ['custom'],
  }
  emit('patch', {
    inventory: [...props.draft.inventory, item],
    coins: props.draft.coins - customPrice.value,
  })
  customName.value = ''
  customPrice.value = 0
}

function openCategory(id: string) {
  openCat.value = openCat.value === id ? null : id
}
const openCat = ref<string | null>('weapon')

const itemsByCategory = computed(() => {
  const out: Record<string, typeof GEAR_CATALOG> = {}
  for (const cat of GEAR_CATEGORIES) out[cat.id] = []
  for (const item of GEAR_CATALOG) {
    const cat = item.tags.find(t => (GEAR_CATEGORIES as readonly { id: string }[]).some(c => c.id === t)) ?? 'gear'
    out[cat].push(item)
  }
  return out
})

const canFinish = computed(() => hpRolled.value)
</script>

<template>
  <div class="step">
    <section class="block">
      <div class="block-header">
        <span class="label">Очки здоровья</span>
        <span class="hint">1 + ТЕЛ = {{ hitDiceCount(draft.stats.con) }} к6, оставляется {{ draft.level }}</span>
      </div>
      <div class="hp-row">
        <span class="hp-value">{{ draft.maxHp || '—' }}</span>
        <button class="btn-primary" @click="rollHp">{{ hpRolled ? 'Перебросить' : 'Бросить ОЗ' }}</button>
      </div>
    </section>

    <section class="block">
      <div class="label">Доспех</div>
      <div class="armor-grid">
        <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'none' }" @click="setArmor('none')">Без</button>
        <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'light' }" @click="setArmor('light')">Лёгкий (1)</button>
        <button class="armor-card" :class="{ 'armor-card--active': draft.armor.type === 'full' }" @click="setArmor('full')">Полный (2)</button>
      </div>
      <label class="check">
        <input type="checkbox" :checked="draft.armor.shield" @change="toggleShield" />
        Щит (+1)
      </label>
    </section>

    <section class="block">
      <div class="block-header">
        <span class="label">Снаряжение</span>
        <span class="coins">💰 {{ draft.coins }}с</span>
      </div>

      <div v-for="cat in GEAR_CATEGORIES" :key="cat.id" class="cat">
        <button class="cat__head" @click="openCategory(cat.id)">
          <span>{{ cat.name }}</span>
          <span>{{ openCat === cat.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="openCat === cat.id" class="cat__body">
          <button
            v-for="item in itemsByCategory[cat.id]"
            :key="item.templateId"
            class="gear-item"
            :disabled="(item.price ?? 0) > draft.coins"
            @click="addFromCatalog(item.templateId)"
          >
            <div class="gear-item__name">{{ item.name }}</div>
            <div class="gear-item__meta">
              <span>{{ item.price }}с</span>
              <span v-if="item.damage">· урон {{ item.damage }}</span>
            </div>
            <div v-if="item.notes" class="gear-item__notes">{{ item.notes }}</div>
          </button>
        </div>
      </div>

      <div class="custom">
        <div class="label">Свой предмет</div>
        <div class="custom__row">
          <input class="input" placeholder="Название" v-model="customName" />
          <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="customPrice" />
          <button class="btn-ghost" :disabled="!customName.trim() || customPrice > draft.coins" @click="addCustom">+</button>
        </div>
      </div>

      <div v-if="draft.inventory.length" class="inventory">
        <div class="label">Куплено</div>
        <div v-for="item in draft.inventory" :key="item.id" class="inv-row">
          <span class="inv-row__name">{{ item.name }}</span>
          <span class="inv-row__price">{{ item.price ?? 0 }}с</span>
          <button class="btn-mini" @click="removeItem(item.id)">×</button>
        </div>
      </div>
    </section>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canFinish" @click="emit('finish')">Завершить</button>
    </div>
  </div>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.block { display: flex; flex-direction: column; gap: 8px; }
.block-header { display: flex; justify-content: space-between; align-items: center; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.hp-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.hp-value { font-size: 24px; font-weight: 700; }
.armor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.armor-card { padding: 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; cursor: pointer; border-radius: 4px; }
.armor-card--active { border-color: var(--color-accent); color: var(--color-accent); }
.check { display: flex; align-items: center; gap: 8px; }
.coins { font-weight: 600; }
.cat { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.cat__head { width: 100%; display: flex; justify-content: space-between; padding: 10px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); cursor: pointer; font-family: inherit; font-size: 14px; }
.cat__body { display: flex; flex-direction: column; }
.gear-item { text-align: left; padding: 10px 12px; background: var(--color-bg-dark); border: none; border-top: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; font-family: inherit; }
.gear-item:disabled { opacity: 0.3; cursor: not-allowed; }
.gear-item__name { font-weight: 600; margin-bottom: 2px; }
.gear-item__meta { font-size: 12px; color: var(--color-text-muted); }
.gear-item__notes { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.custom { margin-top: 8px; }
.custom__row { display: grid; grid-template-columns: 1fr 90px auto; gap: 6px; }
.input { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; border-radius: 4px; }
.input--price { width: 90px; }
.inventory { margin-top: 12px; border: 1px solid var(--color-border); border-radius: 4px; }
.inv-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--color-border); }
.inv-row:first-child { border-top: none; }
.btn-mini { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 16px; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 9.2: Commit**

```bash
git add src/features/character-creation/steps/StepGear.vue
git commit -m "feat(creation): rewrite StepGear for HP roll, armor and catalog"
```

---

## Phase 5: In-Game view

### Task 10: Переписать `InGameView` + компоненты

**Files:**
- Replace: `src/features/in-game/InGameView.vue`
- Delete: `src/features/in-game/components/MovesTab.vue`
- Delete: `src/features/in-game/components/BondsTab.vue`
- Delete: `src/features/in-game/components/GearTab.vue`
- Delete: `src/features/in-game/components/HpXpBlock.vue`
- Delete: `src/features/in-game/components/GameHeader.vue`
- Delete: `src/features/in-game/components/StatsGrid.vue`
- Create: `src/features/in-game/components/HeaderStrip.vue`
- Create: `src/features/in-game/components/StatsPanel.vue`
- Create: `src/features/in-game/components/SkillsPanel.vue`
- Create: `src/features/in-game/components/AbilitiesPanel.vue`
- Create: `src/features/in-game/components/CombatPanel.vue`
- Create: `src/features/in-game/components/InventoryPanel.vue`
- Create: `src/features/in-game/components/MagicPanel.vue`
- Create: `src/features/in-game/components/NotesPanel.vue`

- [ ] **Step 10.1: Удалить устаревшие компоненты**

```bash
rm src/features/in-game/components/MovesTab.vue
rm src/features/in-game/components/BondsTab.vue
rm src/features/in-game/components/GearTab.vue
rm src/features/in-game/components/HpXpBlock.vue
rm src/features/in-game/components/GameHeader.vue
rm src/features/in-game/components/StatsGrid.vue
rm src/components/ui/MoveDescription.vue
```

- [ ] **Step 10.2: Создать `HeaderStrip.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { CLASSES } from '@/data/classes'
import { totalArmor, xpToNextLevel, xpProgressPercent, isReadyToLevelUp } from '@/utils/derived'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{
  patch: [Partial<Character>]
  levelUp: []
  back: []
}>()

const className = computed(() => CLASSES[props.char.classId].name)
const armor = computed(() => totalArmor(props.char))
const xpToNext = computed(() => xpToNextLevel(props.char))
const xpPct = computed(() => xpProgressPercent(props.char))
const ready = computed(() => isReadyToLevelUp(props.char))

function bumpHp(delta: number) {
  const next = Math.max(0, Math.min(props.char.maxHp, props.char.currentHp + delta))
  emit('patch', { currentHp: next })
}
function bumpXp(delta: number) {
  emit('patch', { xp: Math.max(0, props.char.xp + delta) })
}
</script>

<template>
  <header class="hdr">
    <div class="hdr__top">
      <button class="btn-ghost" @click="emit('back')">← Список</button>
      <div class="hdr__title">
        <div class="hdr__name">{{ char.name }}</div>
        <div class="label">{{ className }} · Уровень {{ char.level }}<span v-if="char.trueName"> · “{{ char.trueName }}”</span></div>
      </div>
      <div class="hdr__armor">
        <div class="label">Броня</div>
        <div class="hdr__armor-val">{{ armor }}</div>
      </div>
    </div>

    <div v-if="ready" class="levelup">
      <span>Готов к повышению уровня!</span>
      <button class="btn-primary" @click="emit('levelUp')">Повысить ↑</button>
    </div>

    <div class="hdr__meters">
      <div class="meter">
        <div class="meter__label">HP</div>
        <div class="meter__controls">
          <button class="btn-mini" @click="bumpHp(-1)">−</button>
          <span class="meter__val">{{ char.currentHp }} / {{ char.maxHp }}</span>
          <button class="btn-mini" @click="bumpHp(1)">+</button>
        </div>
      </div>
      <div class="meter">
        <div class="meter__label">
          XP {{ xpToNext !== null ? `(до ${xpToNext})` : '(макс)' }}
        </div>
        <div class="meter__controls">
          <button class="btn-mini" @click="bumpXp(-10)">−10</button>
          <span class="meter__val">{{ char.xp }}</span>
          <button class="btn-mini" @click="bumpXp(10)">+10</button>
          <button class="btn-mini" @click="bumpXp(100)">+100</button>
        </div>
        <div class="xp-bar"><div class="xp-bar__fill" :style="{ width: xpPct + '%' }" /></div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hdr { border-bottom: 1px solid var(--color-border); padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.hdr__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.hdr__title { flex: 1; }
.hdr__name { font-size: 20px; font-weight: 700; }
.hdr__armor { text-align: right; }
.hdr__armor-val { font-size: 22px; font-weight: 700; }
.levelup { background: var(--color-bg-elevated); border: 1px solid var(--color-accent); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; font-size: 13px; }
.hdr__meters { display: flex; flex-direction: column; gap: 8px; }
.meter { display: flex; flex-direction: column; gap: 4px; }
.meter__label { font-size: 12px; color: var(--color-text-muted); }
.meter__controls { display: flex; align-items: center; gap: 8px; }
.meter__val { flex: 1; text-align: center; font-weight: 600; }
.btn-mini { padding: 2px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; border-radius: 3px; font-family: inherit; }
.xp-bar { height: 3px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.xp-bar__fill { height: 100%; background: var(--color-accent); transition: width 0.3s; }
</style>
```

- [ ] **Step 10.3: Создать `StatsPanel.vue`**

```vue
<script setup lang="ts">
import type { Character, StatKey } from '@/types/character'
import { STAT_KEYS, STAT_LABELS } from '@/data/xpTable'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

function setStat(key: StatKey, value: number) {
  const v = Math.max(0, Math.min(3, value))
  emit('patch', { stats: { ...props.char.stats, [key]: v } })
}
</script>

<template>
  <section class="panel">
    <div class="label">Характеристики</div>
    <div class="stats">
      <div v-for="key in STAT_KEYS" :key="key" class="stat">
        <div class="stat__label">{{ STAT_LABELS[key] }}</div>
        <input
          type="number"
          class="stat__val"
          min="0"
          max="3"
          :value="char.stats[key]"
          @change="setStat(key, Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.stat { background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; text-align: center; }
.stat__label { font-size: 11px; color: var(--color-text-muted); }
.stat__val { width: 100%; background: none; border: none; color: var(--color-text); font-family: inherit; font-size: 20px; font-weight: 700; text-align: center; padding: 4px; }
</style>
```

- [ ] **Step 10.4: Создать `SkillsPanel.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { SKILLS } from '@/types/character'

const props = defineProps<{ char: Character }>()

const items = computed(() =>
  SKILLS.filter(s => props.char.skillIds.includes(s.id))
)
</script>

<template>
  <section class="panel">
    <div class="label">Навыки</div>
    <ul class="list">
      <li v-for="sk in items" :key="sk.id" class="row">{{ sk.name }}</li>
      <li v-if="!items.length" class="empty">—</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.row { padding: 4px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; font-size: 13px; }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 10.5: Создать `AbilitiesPanel.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character } from '@/types/character'
import { ABILITIES } from '@/types/character'

const props = defineProps<{ char: Character }>()

const items = computed(() => ABILITIES.filter(a => props.char.abilityIds.includes(a.id)))
const expanded = ref<string | null>(null)
</script>

<template>
  <section class="panel">
    <div class="label">Способности</div>
    <ul class="list">
      <li v-for="ab in items" :key="ab.id" class="row">
        <button class="row__head" @click="expanded = expanded === ab.id ? null : ab.id">
          <span>{{ ab.name }}</span>
          <span>{{ expanded === ab.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="expanded === ab.id" class="row__desc">{{ ab.description }}</div>
      </li>
      <li v-if="!items.length" class="empty">—</li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 4px; }
.row { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.row__head { width: 100%; display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); font-family: inherit; cursor: pointer; }
.row__desc { padding: 8px 12px; font-size: 13px; color: var(--color-text-muted); border-top: 1px solid var(--color-border); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 10.6: Создать `CombatPanel.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { damageFormula, totalArmor, armorLabel, isWeapon } from '@/utils/derived'

const props = defineProps<{ char: Character }>()

const weapons = computed(() => props.char.inventory.filter(isWeapon))
const armor = computed(() => totalArmor(props.char))
</script>

<template>
  <section class="panel">
    <div class="label">Бой</div>
    <div class="summary">
      <div>Броня: <b>{{ armor }}</b> ({{ armorLabel(char.armor) }})</div>
      <div>Бонус костей урона: <b>+{{ char.damageBonusDice }}d6</b></div>
    </div>
    <div v-if="weapons.length" class="weapons">
      <div v-for="w in weapons" :key="w.id" class="weapon">
        <div class="weapon__name">{{ w.name }}</div>
        <div class="weapon__dmg">{{ damageFormula(char, w) }}</div>
      </div>
    </div>
    <div v-else class="empty">Нет оружия в инвентаре.</div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.summary { display: flex; gap: 16px; margin-top: 6px; font-size: 13px; color: var(--color-text-muted); }
.weapons { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.weapon { display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.weapon__name { font-weight: 600; }
.weapon__dmg { font-family: monospace; }
.empty { margin-top: 6px; color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 10.7: Создать `InventoryPanel.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, InventoryItem, ArmorType } from '@/types/character'
import { GEAR_CATALOG, GEAR_CATEGORIES, findGearTemplate } from '@/data/gear'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const showCatalog = ref(false)
const openCat = ref<string | null>('weapon')
const customName = ref('')
const customPrice = ref(0)

function setCoins(value: number) {
  emit('patch', { coins: Math.max(0, value) })
}

function setArmorType(type: ArmorType) {
  emit('patch', { armor: { ...props.char.armor, type } })
}
function toggleShield() {
  emit('patch', { armor: { ...props.char.armor, shield: !props.char.armor.shield } })
}

function addFromCatalog(templateId: string) {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: tpl.name,
    price: tpl.price,
    tags: [...tpl.tags],
    damage: tpl.damage,
    notes: tpl.notes,
  }
  emit('patch', {
    inventory: [...props.char.inventory, item],
    coins: Math.max(0, props.char.coins - (tpl.price ?? 0)),
  })
}

function removeItem(id: string) {
  emit('patch', { inventory: props.char.inventory.filter(i => i.id !== id) })
}

function addCustom() {
  if (!customName.value.trim()) return
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: customName.value.trim(),
    price: customPrice.value || undefined,
    tags: ['custom'],
  }
  emit('patch', { inventory: [...props.char.inventory, item] })
  customName.value = ''
  customPrice.value = 0
}

const itemsByCategory = computed(() => {
  const out: Record<string, typeof GEAR_CATALOG> = {}
  for (const cat of GEAR_CATEGORIES) out[cat.id] = []
  for (const item of GEAR_CATALOG) {
    const cat = item.tags.find(t => (GEAR_CATEGORIES as readonly { id: string }[]).some(c => c.id === t)) ?? 'gear'
    out[cat].push(item)
  }
  return out
})
</script>

<template>
  <section class="panel">
    <div class="coins-row">
      <span class="label">Монеты</span>
      <input
        type="number"
        class="coins-input"
        :value="char.coins"
        min="0"
        @change="setCoins(Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="armor">
      <div class="label">Доспех</div>
      <div class="armor-grid">
        <button :class="{ 'active': char.armor.type === 'none' }" @click="setArmorType('none')">Без</button>
        <button :class="{ 'active': char.armor.type === 'light' }" @click="setArmorType('light')">Лёгкий</button>
        <button :class="{ 'active': char.armor.type === 'full' }" @click="setArmorType('full')">Полный</button>
      </div>
      <label class="shield"><input type="checkbox" :checked="char.armor.shield" @change="toggleShield" /> Щит</label>
    </div>

    <div class="list">
      <div class="label">Инвентарь</div>
      <div v-for="item in char.inventory" :key="item.id" class="inv-row">
        <div>
          <div class="inv-row__name">{{ item.name }}</div>
          <div v-if="item.notes" class="inv-row__notes">{{ item.notes }}</div>
        </div>
        <div class="inv-row__right">
          <span v-if="item.damage" class="tag">{{ item.damage }}</span>
          <span v-if="item.price" class="tag">{{ item.price }}с</span>
          <button class="btn-mini" @click="removeItem(item.id)">×</button>
        </div>
      </div>
      <div v-if="!char.inventory.length" class="empty">Пусто.</div>
    </div>

    <div class="custom">
      <div class="label">Добавить свой</div>
      <div class="custom__row">
        <input class="input" placeholder="Название" v-model="customName" />
        <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="customPrice" />
        <button class="btn-ghost" :disabled="!customName.trim()" @click="addCustom">+</button>
      </div>
    </div>

    <button class="btn-ghost catalog-toggle" @click="showCatalog = !showCatalog">
      {{ showCatalog ? 'Скрыть каталог' : 'Купить из каталога' }}
    </button>

    <div v-if="showCatalog" class="catalog">
      <div v-for="cat in GEAR_CATEGORIES" :key="cat.id" class="cat">
        <button class="cat__head" @click="openCat = openCat === cat.id ? null : cat.id">
          <span>{{ cat.name }}</span>
          <span>{{ openCat === cat.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="openCat === cat.id">
          <button
            v-for="item in itemsByCategory[cat.id]"
            :key="item.templateId"
            class="gear-item"
            @click="addFromCatalog(item.templateId)"
          >
            <div class="gear-item__name">{{ item.name }}</div>
            <div class="gear-item__meta">
              <span>{{ item.price }}с</span>
              <span v-if="item.damage">· {{ item.damage }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; }
.coins-row { display: flex; justify-content: space-between; align-items: center; }
.coins-input { width: 100px; text-align: right; padding: 6px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.armor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
.armor-grid button { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; border-radius: 3px; font-family: inherit; }
.armor-grid .active { border-color: var(--color-accent); color: var(--color-accent); }
.shield { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 13px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.inv-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; gap: 8px; }
.inv-row__name { font-weight: 600; }
.inv-row__notes { font-size: 11px; color: var(--color-text-muted); }
.inv-row__right { display: flex; align-items: center; gap: 6px; }
.tag { font-size: 11px; color: var(--color-text-muted); }
.btn-mini { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 16px; }
.custom__row { display: grid; grid-template-columns: 1fr 90px auto; gap: 6px; }
.input { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.catalog { display: flex; flex-direction: column; gap: 6px; }
.cat { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.cat__head { width: 100%; display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); cursor: pointer; font-family: inherit; }
.gear-item { text-align: left; padding: 8px 12px; background: var(--color-bg-dark); border: none; border-top: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; font-family: inherit; width: 100%; }
.gear-item__name { font-weight: 600; }
.gear-item__meta { font-size: 11px; color: var(--color-text-muted); }
.empty { color: var(--color-text-muted); font-size: 13px; }
.catalog-toggle { align-self: flex-start; }
</style>
```

- [ ] **Step 10.8: Создать `MagicPanel.vue`**

```vue
<script setup lang="ts">
import type { Character, Spirit, Magic } from '@/types/character'
import { SPHERE_PRESETS } from '@/data/spheres'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

function ensureMagic(): Magic {
  return props.char.magic ?? { spirits: [], rituals: [], cantrips: [] }
}

function updateSpirit(idx: number, patch: Partial<Spirit>) {
  const magic = ensureMagic()
  const spirits = magic.spirits.map((s, i) => (i === idx ? { ...s, ...patch } : s))
  emit('patch', { magic: { ...magic, spirits } })
}

function addSpirit() {
  const magic = ensureMagic()
  emit('patch', {
    magic: {
      ...magic,
      spirits: [...magic.spirits, { id: crypto.randomUUID(), name: '', appearance: '', sphere1: '', sphere2: '' }],
    },
  })
}

function removeSpirit(id: string) {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, spirits: magic.spirits.filter(s => s.id !== id) } })
}

function updateRitual(idx: number, value: string) {
  const magic = ensureMagic()
  const rituals = [...magic.rituals]
  rituals[idx] = value
  emit('patch', { magic: { ...magic, rituals } })
}
function addRitual() {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, rituals: [...magic.rituals, ''] } })
}
function removeRitual(idx: number) {
  const magic = ensureMagic()
  emit('patch', { magic: { ...magic, rituals: magic.rituals.filter((_, i) => i !== idx) } })
}
</script>

<template>
  <section class="panel">
    <div class="group">
      <div class="label-row">
        <span class="label">Духи</span>
        <button class="btn-ghost" @click="addSpirit">+ Дух</button>
      </div>
      <div v-for="(sp, idx) in (char.magic?.spirits ?? [])" :key="sp.id" class="spirit">
        <input class="input" placeholder="Имя" :value="sp.name" @input="updateSpirit(idx, { name: ($event.target as HTMLInputElement).value })" />
        <input class="input" placeholder="Облик" :value="sp.appearance" @input="updateSpirit(idx, { appearance: ($event.target as HTMLInputElement).value })" />
        <div class="spheres">
          <input class="input" list="sphere-presets" placeholder="Сфера 1" :value="sp.sphere1" @input="updateSpirit(idx, { sphere1: ($event.target as HTMLInputElement).value })" />
          <input class="input" list="sphere-presets" placeholder="Сфера 2" :value="sp.sphere2" @input="updateSpirit(idx, { sphere2: ($event.target as HTMLInputElement).value })" />
        </div>
        <button class="btn-mini" @click="removeSpirit(sp.id)">Удалить</button>
      </div>
      <datalist id="sphere-presets">
        <option v-for="s in SPHERE_PRESETS" :key="s" :value="s" />
      </datalist>
    </div>

    <div class="group">
      <div class="label-row">
        <span class="label">Ритуалы</span>
        <button class="btn-ghost" @click="addRitual">+ Ритуал</button>
      </div>
      <div v-for="(r, idx) in (char.magic?.rituals ?? [])" :key="idx" class="ritual-row">
        <input class="input" :value="r" @input="updateRitual(idx, ($event.target as HTMLInputElement).value)" />
        <button class="btn-mini" @click="removeRitual(idx)">×</button>
      </div>
    </div>

    <div v-if="(char.magic?.cantrips?.length ?? 0) > 0" class="group">
      <div class="label">Заклички</div>
      <ul class="cantrips">
        <li v-for="c in char.magic?.cantrips" :key="c">{{ c }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 18px; }
.group { display: flex; flex-direction: column; gap: 6px; }
.label-row { display: flex; justify-content: space-between; align-items: center; }
.spirit { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 6px; }
.spheres { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.input { padding: 6px 10px; background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; font-size: 13px; }
.ritual-row { display: grid; grid-template-columns: 1fr auto; gap: 6px; }
.btn-mini { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 12px; }
.cantrips { list-style: disc; padding-left: 18px; color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 10.9: Создать `NotesPanel.vue`**

```vue
<script setup lang="ts">
import type { Character } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

function save(e: Event) {
  emit('patch', { notes: (e.target as HTMLTextAreaElement).value })
}
</script>

<template>
  <section class="panel">
    <div class="label">Заметки</div>
    <textarea class="notes" :value="char.notes" @blur="save" placeholder="Заметки по персонажу, миру, сюжету…"></textarea>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; height: 100%; }
.notes { flex: 1; min-height: 60vh; padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); font-family: inherit; font-size: 14px; border-radius: 4px; resize: vertical; }
</style>
```

- [ ] **Step 10.10: Переписать `InGameView.vue`**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import HeaderStrip from './components/HeaderStrip.vue'
import StatsPanel from './components/StatsPanel.vue'
import SkillsPanel from './components/SkillsPanel.vue'
import AbilitiesPanel from './components/AbilitiesPanel.vue'
import CombatPanel from './components/CombatPanel.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import MagicPanel from './components/MagicPanel.vue'
import NotesPanel from './components/NotesPanel.vue'
import type { Character } from '@/types/character'

type Tab = 'main' | 'combat' | 'inventory' | 'magic' | 'notes'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

function patch(data: Partial<Character>) {
  characters.update(id.value, data)
}

const activeTab = ref<Tab>('main')

const hasMagic = computed(() => !!char.value?.magic || char.value?.classId === 'wizard')
const tabs = computed<{ id: Tab; label: string }[]>(() => {
  const base: { id: Tab; label: string }[] = [
    { id: 'main', label: 'Основное' },
    { id: 'combat', label: 'Бой' },
    { id: 'inventory', label: 'Инвентарь' },
  ]
  if (hasMagic.value) base.push({ id: 'magic', label: 'Магия' })
  base.push({ id: 'notes', label: 'Заметки' })
  return base
})
</script>

<template>
  <div v-if="char" class="content-wrap">
    <HeaderStrip
      :char="char"
      @patch="patch"
      @level-up="router.push(`/character/${id}/levelup`)"
      @back="router.push('/')"
    />

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ 'tab--active': activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
    </nav>

    <div v-if="activeTab === 'main'">
      <StatsPanel :char="char" @patch="patch" />
      <SkillsPanel :char="char" />
      <AbilitiesPanel :char="char" />
    </div>
    <CombatPanel v-else-if="activeTab === 'combat'" :char="char" />
    <InventoryPanel v-else-if="activeTab === 'inventory'" :char="char" @patch="patch" />
    <MagicPanel v-else-if="activeTab === 'magic'" :char="char" @patch="patch" />
    <NotesPanel v-else-if="activeTab === 'notes'" :char="char" @patch="patch" />
  </div>
</template>

<style scoped>
.tabs { display: flex; border-bottom: 1px solid var(--color-border); background: var(--color-bg-dark); position: sticky; top: 0; z-index: 10; }
.tab { flex: 1; padding: 12px 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); font-family: inherit; font-size: 13px; cursor: pointer; }
.tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
</style>
```

- [ ] **Step 10.11: Commit**

```bash
git add src/features/in-game src/components
git rm src/features/in-game/components/MovesTab.vue src/features/in-game/components/BondsTab.vue src/features/in-game/components/GearTab.vue src/features/in-game/components/HpXpBlock.vue src/features/in-game/components/GameHeader.vue src/features/in-game/components/StatsGrid.vue src/components/ui/MoveDescription.vue 2>/dev/null || true
git commit -m "feat(in-game): rewrite for WoD (header, panels, tabs)"
```

---

## Phase 6: Level-up flow

### Task 11: Переписать `LevelUpView` + шаги

**Files:**
- Replace: `src/features/level-up/LevelUpView.vue`
- Delete: `src/features/level-up/components/LevelStatStep.vue`
- Delete: `src/features/level-up/components/LevelMoveStep.vue`
- Create: `src/features/level-up/components/RewardsSummary.vue`
- Create: `src/features/level-up/components/HitDiceRollStep.vue`
- Create: `src/features/level-up/components/SkillPickStep.vue`
- Create: `src/features/level-up/components/AbilityPickStep.vue`
- Create: `src/features/level-up/components/StatBumpStep.vue`

- [ ] **Step 11.1: Удалить старые шаги**

```bash
rm src/features/level-up/components/LevelStatStep.vue
rm src/features/level-up/components/LevelMoveStep.vue
```

- [ ] **Step 11.2: Создать `RewardsSummary.vue`**

```vue
<script setup lang="ts">
import type { LevelReward } from '@/data/xpTable'

defineProps<{ reward: LevelReward; targetLevel: number }>()
</script>

<template>
  <section class="summary">
    <div class="label">Уровень {{ targetLevel }}: награды</div>
    <ul>
      <li v-if="reward.hitDice">+1 hit die (бросок d6 → добавляется к max HP)</li>
      <li v-if="reward.skills">+1 навык (на выбор)</li>
      <li v-if="reward.abilities">+1 способность (на выбор)</li>
      <li v-if="reward.statBonus">+1 к одной характеристике (макс +3)</li>
      <li v-if="reward.damageDice">+1d6 к урону</li>
    </ul>
  </section>
</template>

<style scoped>
.summary { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
ul { margin: 6px 0 0; padding-left: 18px; }
li { font-size: 14px; }
</style>
```

- [ ] **Step 11.3: Создать `HitDiceRollStep.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { rollD6 } from '@/utils/derived'

const emit = defineEmits<{ done: [hpDelta: number] }>()
const roll = ref<number | null>(null)

function doRoll() {
  roll.value = rollD6()
}
function confirm() {
  if (roll.value !== null) emit('done', roll.value)
}
</script>

<template>
  <section class="step">
    <div class="label">Бросок нового hit die (d6)</div>
    <div class="roll">
      <span class="roll__val">{{ roll ?? '—' }}</span>
      <button class="btn-primary" @click="doRoll">{{ roll === null ? 'Бросить' : 'Перебросить' }}</button>
    </div>
    <button class="btn-primary" :disabled="roll === null" @click="confirm">Принять (+{{ roll ?? 0 }} HP)</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.roll { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.roll__val { font-size: 32px; font-weight: 700; flex: 1; text-align: center; }
</style>
```

- [ ] **Step 11.4: Создать `SkillPickStep.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, SkillId } from '@/types/character'
import { SKILLS } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [id: SkillId] }>()

const picked = ref<SkillId | null>(null)
const available = computed(() => SKILLS.filter(s => !props.char.skillIds.includes(s.id)))
</script>

<template>
  <section class="step">
    <div class="label">Выбери новый навык</div>
    <div class="list">
      <label v-for="s in available" :key="s.id" class="row" :class="{ 'row--picked': picked === s.id }">
        <input type="radio" :value="s.id" v-model="picked" />
        {{ s.name }}
      </label>
      <div v-if="!available.length" class="empty">Все навыки уже освоены.</div>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.row { padding: 10px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; align-items: center; gap: 8px; cursor: pointer; }
.row--picked { border-color: var(--color-accent); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 11.5: Создать `AbilityPickStep.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, AbilityId } from '@/types/character'
import { ABILITIES } from '@/types/character'
import { CLASSES } from '@/data/classes'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [id: AbilityId] }>()

const picked = ref<AbilityId | null>(null)

const available = computed(() => {
  const cls = CLASSES[props.char.classId]
  return ABILITIES.filter(a =>
    cls.abilityPool.includes(a.id) && !props.char.abilityIds.includes(a.id),
  )
})
</script>

<template>
  <section class="step">
    <div class="label">Выбери новую способность</div>
    <div class="list">
      <label v-for="a in available" :key="a.id" class="row" :class="{ 'row--picked': picked === a.id }">
        <input type="radio" :value="a.id" v-model="picked" />
        <div>
          <div class="name">{{ a.name }}</div>
          <div class="desc">{{ a.description }}</div>
        </div>
      </label>
      <div v-if="!available.length" class="empty">Весь класс-пул уже освоен.</div>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.list { display: flex; flex-direction: column; gap: 4px; }
.row { padding: 10px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
.row--picked { border-color: var(--color-accent); }
.name { font-weight: 600; }
.desc { font-size: 12px; color: var(--color-text-muted); }
.empty { color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 11.6: Создать `StatBumpStep.vue`**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, StatKey } from '@/types/character'
import { STAT_KEYS, STAT_LABELS, MAX_STAT_BONUS } from '@/data/xpTable'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ done: [key: StatKey] }>()

const picked = ref<StatKey | null>(null)
const available = computed(() => STAT_KEYS.filter(k => props.char.stats[k] < MAX_STAT_BONUS))
</script>

<template>
  <section class="step">
    <div class="label">+1 к характеристике (макс +{{ MAX_STAT_BONUS }})</div>
    <div class="grid">
      <label v-for="k in STAT_KEYS" :key="k" class="cell" :class="{ 'cell--picked': picked === k, 'cell--disabled': !available.includes(k) }">
        <input type="radio" :value="k" v-model="picked" :disabled="!available.includes(k)" />
        <span class="cell__name">{{ STAT_LABELS[k] }}</span>
        <span class="cell__val">{{ char.stats[k] }} → {{ Math.min(MAX_STAT_BONUS, char.stats[k] + 1) }}</span>
      </label>
    </div>
    <button class="btn-primary" :disabled="!picked" @click="picked && emit('done', picked)">Принять</button>
  </section>
</template>

<style scoped>
.step { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cell { padding: 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; display: flex; flex-direction: column; gap: 2px; text-align: center; cursor: pointer; }
.cell--picked { border-color: var(--color-accent); }
.cell--disabled { opacity: 0.3; cursor: not-allowed; }
.cell__name { font-weight: 600; }
.cell__val { font-size: 12px; color: var(--color-text-muted); }
</style>
```

- [ ] **Step 11.7: Переписать `LevelUpView.vue`**

```vue
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import type { Character, SkillId, AbilityId, StatKey } from '@/types/character'
import { getReward } from '@/data/xpTable'
import RewardsSummary from './components/RewardsSummary.vue'
import HitDiceRollStep from './components/HitDiceRollStep.vue'
import SkillPickStep from './components/SkillPickStep.vue'
import AbilityPickStep from './components/AbilityPickStep.vue'
import StatBumpStep from './components/StatBumpStep.vue'

type Phase = 'hitDice' | 'skill' | 'ability' | 'stat' | 'confirm'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))
const targetLevel = computed(() => (char.value ? char.value.level + 1 : 1))
const reward = computed(() => getReward(targetLevel.value))

const pendingPatch = ref<Partial<Character>>({})
const phase = ref<Phase>('hitDice')
const done = ref({ hitDice: false, skill: false, ability: false, stat: false })

onMounted(() => {
  if (!char.value || !reward.value) {
    router.push('/')
    return
  }
  // автобонус к урону
  if (reward.value.damageDice) {
    pendingPatch.value.damageBonusDice = (char.value.damageBonusDice ?? 0) + reward.value.damageDice
  }
  advance()
})

function advance() {
  const r = reward.value
  if (!r) return
  if (r.hitDice && !done.value.hitDice) { phase.value = 'hitDice'; return }
  if (r.skills && !done.value.skill) { phase.value = 'skill'; return }
  if (r.abilities && !done.value.ability) { phase.value = 'ability'; return }
  if (r.statBonus && !done.value.stat) { phase.value = 'stat'; return }
  phase.value = 'confirm'
}

function onHitDice(delta: number) {
  if (!char.value) return
  pendingPatch.value.maxHp = (pendingPatch.value.maxHp ?? char.value.maxHp) + delta
  pendingPatch.value.currentHp = (pendingPatch.value.currentHp ?? char.value.currentHp) + delta
  pendingPatch.value.hitDice = (pendingPatch.value.hitDice ?? char.value.hitDice) + 1
  done.value.hitDice = true
  advance()
}

function onSkill(sid: SkillId) {
  if (!char.value) return
  const current = pendingPatch.value.skillIds ?? char.value.skillIds
  pendingPatch.value.skillIds = [...current, sid]
  done.value.skill = true
  advance()
}

function onAbility(aid: AbilityId) {
  if (!char.value) return
  const current = pendingPatch.value.abilityIds ?? char.value.abilityIds
  pendingPatch.value.abilityIds = [...current, aid]
  done.value.ability = true
  advance()
}

function onStat(key: StatKey) {
  if (!char.value) return
  const base = pendingPatch.value.stats ?? char.value.stats
  pendingPatch.value.stats = { ...base, [key]: Math.min(3, base[key] + 1) }
  done.value.stat = true
  advance()
}

function apply() {
  if (!char.value) return
  characters.applyLevelUp(id.value, {
    ...pendingPatch.value,
    level: targetLevel.value,
  })
  router.push(`/character/${id.value}`)
}
</script>

<template>
  <div v-if="char && reward" class="content-wrap">
    <header class="hdr">
      <button class="btn-ghost" @click="router.push(`/character/${id}`)">← Назад</button>
      <div>
        <div class="label">Повышение уровня</div>
        <div class="hdr__level">Уровень {{ char.level }} → {{ targetLevel }}</div>
      </div>
      <div></div>
    </header>

    <RewardsSummary :reward="reward" :target-level="targetLevel" />

    <HitDiceRollStep v-if="phase === 'hitDice'" @done="onHitDice" />
    <SkillPickStep v-else-if="phase === 'skill'" :char="char" @done="onSkill" />
    <AbilityPickStep v-else-if="phase === 'ability'" :char="char" @done="onAbility" />
    <StatBumpStep v-else-if="phase === 'stat'" :char="char" @done="onStat" />
    <section v-else-if="phase === 'confirm'" class="confirm">
      <div class="label">Готово — применить изменения?</div>
      <button class="btn-primary" @click="apply">Применить</button>
    </section>
  </div>
</template>

<style scoped>
.hdr { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--color-border); }
.hdr__level { font-size: 16px; font-weight: 700; }
.confirm { padding: 24px 16px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
</style>
```

- [ ] **Step 11.8: Commit**

```bash
git add src/features/level-up
git commit -m "feat(level-up): rewrite flow for WoD rewards"
```

---

## Phase 7: Финальная зачистка и верификация

### Task 12: Проверка сборки и ручная проверка флоу

**Files:**
- (verification only)

- [ ] **Step 12.1: Type-check и сборка**

```bash
npm run build
```

Expected: успешная сборка без TypeScript-ошибок. Если есть ошибки — исправляй по месту, чаще всего причина — забытый импорт или ссылка на удалённый модуль/поле. Не добавляй обратно старые типы — правь консьюмер.

- [ ] **Step 12.2: Запустить dev-сервер и пройти флоу руками**

```bash
npm run dev
```

Проверь в браузере по порядку:
1. Главный экран `/` — список персонажей (пусто). Нажми «+ Новый».
2. **StepIdentity**: введи имя, выбери класс, нажми «Бросить все 2d6», убедись что бонусы 0..+3. Перебрось одну. Отредактируй бонус вручную. «Далее».
3. **StepTraining**: автонавык отмечен и disabled. Выбери 1 дополнительный. Автоспособность (для Wizard) видна. Выбери требуемые способности из пула. Для Wizard заполни 2 духа. Если взял «Ритуал» — заполни 2 ритуала. «Далее».
4. **StepGear**: бросок ОЗ, выбор доспеха + щит, покупка из каталога (баланс 60с), свой предмет, удаление из инвентаря (возврат монет). «Завершить».
5. **InGameView**: хэдер с HP/XP/бронёй, табы «Основное/Бой/Инвентарь/(Магия)/Заметки». Проверь каждый таб. Добавь XP до уровня 2 — появится бейдж «готов к повышению».
6. **LevelUp**: пройди шаги (hit die roll → навык → способность → стат → confirm), проверь что после подтверждения возвращаешься в in-game, уровень вырос, XP не обнулился.
7. **Refresh** страницы на каждом шаге — данные должны выживать (localStorage).

Если что-то не работает — отлаживай на месте (см. DevTools → console), правь компонент, коммить отдельным фиксом.

- [ ] **Step 12.3: Финальный commit**

Если по ходу ручной проверки были правки — накатить коммитом вида:

```bash
git add -A
git commit -m "fix: post-migration UX tweaks"
```

Иначе — ничего коммитить не нужно.

---

## Self-Review Checklist (выполнено автором плана)

**Spec coverage:**
- ✅ Новые типы (Task 1) — соответствует блоку «Модель персонажа» спеки.
- ✅ `src/data/` — Task 2 покрывает classes, gear, spheres, xpTable. `skills.ts` и `abilities.ts` — совмещены с `src/types/character.ts` (`SKILLS`, `ABILITIES` как `as const`), согласно решению «один источник правды» в спеке; отдельные файлы не создаются, так как это дублирование. `src/data/skills.ts`/`abilities.ts` из спеки — это re-export, не нужны.
- ✅ Stores (Tasks 4–5).
- ✅ Creation wizard 3 шага (Tasks 7–9).
- ✅ In-game (Task 10) — все панели, табы.
- ✅ Level-up (Task 11) — автонаграды + 4 интерактивных шага.
- ✅ Удаление DW-артефактов (в каждом task удаляются связанные файлы).
- ✅ localStorage ключ `wod.characters.v1`, старый ключ не читается (Task 4).

**Placeholder scan:** нет TBD/TODO/«implement later». Все шаги содержат полный код или точные команды.

**Type consistency:** имена полей и функций выровнены между задачами (`totalArmor`, `damageFormula`, `xpToNextLevel`, `isReadyToLevelUp`, `rollHitDice`, `hitDiceCount`, `roll2d6`, `statBonusFrom2d6`, `rollD6` — все определены в Task 3 и используются далее).

**Nota bene:** `src/data/skills.ts` и `src/data/abilities.ts` из спеки ре-экспорты не понадобились — консьюмеры импортируют `SKILLS`/`ABILITIES` напрямую из `@/types/character`. Это упрощение, не расхождение.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-wod-migration.md`. Two execution options:

1. **Subagent-Driven (recommended)** — отдельный subagent на задачу, обзор между задачами, быстрая итерация.
2. **Inline Execution** — выполнение в этой же сессии через executing-plans, чекпойнты для обзора.

Какой подход выберем?
