# Миграция с Dungeon World на World of Dungeons

**Дата:** 2026-04-17
**Статус:** Design approved, ready for implementation plan

## Контекст

Проект — интерактивный лист персонажа для настольной RPG. Изначально реализован под *Dungeon World* (PbtA, сложные «ходы», bonds, alignments, debilities). Меняем систему на **World of Dungeons** (J.C. Harper & C. McDowell, 1979) — минималистичный OSR-like ruleset в рамках одной страницы правил.

Референс правил: `ref/world_of_dungeons_1979_ru.md`, `ref/world_of_dungeons_1979.md`, `ref/world_of_dungeons_1979_bw.pdf`.

## Цели и ограничения

- Полная замена механики: все DW-специфичные поля, компоненты, данные — удаляются.
- Каркас приложения сохраняется: Vue 3 + TS + Pinia + Reka UI, feature-based структура, localStorage, Router.
- Mobile-first UX остаётся ключевым требованием.
- Тесты в проекте не пишутся (см. MEMORY).
- Кастомный класс не поддерживается на этой итерации — только 5 базовых (Fighter, Thief, Cleric, Wizard, Ranger).
- Старые персонажи из localStorage не мигрируются — пишутся под новым ключом, старый игнорируется.

## Обзор системы WoD

- **6 характеристик** (СИЛ/ЛОВ/ТЕЛ/ИНТ/МУД/ХАР): бросок 2к6 → бонус 0/+1/+2/+3.
- **9 навыков** (чекбокс): Атлетика, Внимательность, Обман, Расшифровка, Лечение, Лидерство, Знания, Скрытность, Выживание.
- **20 особых способностей** (чекбокс): Благословение, Исцеление, Отвращение нежити, Видение, Стойкость, Манёвренность, Рубка, Прочность, Удар из тени, Удача, Реакция, Умелец, Заклички, Подчинение, Ритуал, Призыв, Питомец, Разведка, Залп, Дикарь.
- **5 классов**: каждый даёт фиксированный навык + пул из 4 способностей (выбирается 2). Исключения: Клерик даёт 2 навыка; Волшебник автоматически получает «Призыв» и выбирает 1 из 3 способностей.
- **Броня**: none / light / full + shield (1 / 2 + shield = +1).
- **Урон**: d6 (лёгкое оружие), d6+1 (боевое/лук), d6+2 (тяжёлое/тяжёлый лук). На уровнях 5 и 10 прибавляется +1d6 к урону.
- **ОЗ**: `1 + CON` hit dice (к6), бросается N кубиков, оставляется `level` лучших = maxHp.
- **XP**: таблица от 0 до 45 000 за уровень 10.

## Архитектура и решения

### Модель персонажа (`src/types/character.ts`)

```ts
export const SKILLS = [ { id: 'athletics', name: 'Атлетика' }, … ] as const
export type SkillId = typeof SKILLS[number]['id']

export const ABILITIES = [ { id: 'blessing', name: 'Благословение', description: '…' }, … ] as const
export type AbilityId = typeof ABILITIES[number]['id']

export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Stats = Record<StatKey, number>      // итоговый бонус 0..+3

export type ArmorType = 'none' | 'light' | 'full'
export interface ArmorState { type: ArmorType; shield: boolean }

export interface InventoryItem {
  id: string
  name: string
  price?: number
  tags: string[]                 // 'weapon'|'armor'|'gear'|'occult'|'rare'|'tool'|'light'|'battle'|'heavy'|'ranged'|…
  damage?: string                // 'd6' | 'd6+1' | 'd6+2'
  notes?: string
}

export interface Spirit { id: string; name: string; appearance: string; sphere1: string; sphere2: string }

export interface Magic {
  spirits: Spirit[]              // стартово 2 для Wizard
  rituals: string[]              // только если взята способность 'ritual' (стартово 2)
  cantrips: string[]             // только если взята 'incantations' — ['Свеча','Тень','Чревовещание']
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
  level: number                  // 1..10
  xp: number

  stats: Stats
  statRolls: Record<StatKey, number>
  hitDice: number                // 1 + CON, обновляется на hit-dice уровнях
  currentHp: number
  maxHp: number

  skillIds: SkillId[]            // все взятые (включая автоматические)
  abilityIds: AbilityId[]        // все взятые (включая автоматические)

  armor: ArmorState
  inventory: InventoryItem[]
  coins: number

  magic?: Magic                  // только для wizard

  damageBonusDice: number        // 0 стартово, +1 на уровне 5, +2 на 10
  notes: string
}

export interface ClassData {
  id: ClassId
  name: string
  grantedSkillIds: SkillId[]     // 1 у большинства, 2 у cleric
  abilityPool: AbilityId[]       // из чего игрок выбирает 2
  autoAbilityIds?: AbilityId[]   // wizard: ['summoning']
  hasMagic: boolean
}
```

Ключевые решения:
- Один источник правды для списков навыков/способностей — массив `as const`, TypeScript-типы выводятся из него.
- `magic` — опциональное поле, только для Wizard. Не засоряет общий интерфейс.
- `totalArmor`, `damageFormula`, `xpToNextLevel` — вычисляемые функции в `src/utils/derived.ts`, не хранятся.
- Всё DW-специфичное (moves, bonds, alignments, race, look, debilities, signatureWeapon, maxLoad, damageDice-строка) **удаляется**.
- **Кол-во выборов на создании:** игрок всегда выбирает **1 навык** сверх автоматических (их у большинства 1, у Клерика 2) и **(2 − autoAbilityIds.length)** способностей (обычно 2; у Волшебника — 1, так как `summoning` в авто).

### Справочные данные (`src/data/`)

```
src/data/
├── skills.ts         // re-export SKILLS
├── abilities.ts      // ABILITIES с описаниями из референса
├── classes.ts        // CLASSES: Record<ClassId, ClassData>
├── gear.ts           // GEAR_CATALOG: оружие/доспех/походное/инструменты/оккультное/редкое/огненное масло
├── spheres.ts        // SPHERE_PRESETS: огонь/тень/камень/молния/тайны/страх + custom
└── xpTable.ts        // XP_THRESHOLDS[10], LEVEL_REWARDS[]
```

Содержимое классов:
- **Fighter**: skill=athletics, pool=[skirmish (Манёвренность), toughness (Прочность), hewing (Рубка), sturdy (Стойкость)]
- **Thief**: skill=stealth, pool=[shadowStrike, luck, reflexes, skilled]
- **Cleric**: skills=[decipher, healing], pool=[blessing, healingAbility, turnUndead, vision]
- **Wizard**: skill=lore, autoAbilityIds=['summoning'], pool=[incantations, domination, ritual], hasMagic=true
- **Ranger**: skill=survival, pool=[pet, scouting, volley, savage]

`LEVEL_REWARDS` — массив объектов `{ level, hitDice?, skills?, abilities?, statBonus?, damageDice? }`, по одному для каждого уровня 2..10, точно по таблице правил.

### Stores (`src/stores/`)

**`characters.ts`** (переписывается):
- State: `characters: Character[]`, `activeId: string | null`
- Actions: `create(draft)`, `update(id, patch)`, `delete(id)`, `setActive(id)`, `applyLevelUp(id, patch)`
- Getters: `active`, `byId`, `isReadyToLevelUp(char)`
- Persistence: watch → localStorage `wod.characters.v1`. Старый ключ `characters` (DW) игнорируется при загрузке.

**`creation.ts`** (переписывается):
- State: `draft: Partial<Character>`
- Actions по шагам: `setIdentity`, `rollAllStats`, `rollOneStat`, `setStatManual`, `toggleSkill`, `toggleAbility`, `setSpirit`, `addRitual`, `rollHp`, `setArmor`, `addGear`, `removeGear`, `setCustomItem`, `finalize`
- `finalize()` → `charactersStore.create({...draft, status:'active'})` и `setActive`.

### Вычисляемые функции (`src/utils/derived.ts`)

```ts
totalArmor(char): number             // base + shield + Прочность bonus
damageFormula(char, weapon): string  // 'd6+1 +Рубка' и т.п.
xpToNextLevel(char): number          // XP_THRESHOLDS[level] - xp
hitDiceFormula(char): string         // '1 + CON = N к6'
```

### UI: Creation flow (3 шага)

```
src/features/character-creation/
├── CharacterCreationView.vue
└── steps/
    ├── StepIdentity.vue       // имя, true name, класс, характеристики (роллер + ручной ввод)
    ├── StepTraining.vue       // 1 навык (+ авто), 2 способности (+ авто), магия для wizard
    └── StepGear.vue           // бросок ОЗ, доспех, каталог снаряжения с балансом серебра
```

Валидация перехода между шагами:
- (1 → 2): имя не пустое, класс выбран, все 6 статов присвоены.
- (2 → 3): выбран ровно **1 дополнительный навык** (не из автоматических), выбрано **(2 − autoAbilityIds.length)** способностей (для Волшебника — 1, для остальных — 2); если `classId === 'wizard'` — оба духа заполнены (имя + облик + 2 сферы); если выбрана способность `ritual` — введено 2 стартовых ритуала.
- Завершение: брошены ОЗ (maxHp > 0).

### UI: In-Game view

```
src/features/in-game/
├── InGameView.vue              // хэдер + табы (mobile: bottom bar, desktop: sidebar)
└── components/
    ├── HeaderStrip.vue         // имя, класс, уровень, HP, XP, броня, кнопка level-up при готовности
    ├── StatsPanel.vue          // 6 статов в сетке 3×2, инлайн-редактирование
    ├── SkillsPanel.vue         // взятые навыки с описаниями
    ├── AbilitiesPanel.vue      // взятые способности, раскрывающиеся описания
    ├── CombatPanel.vue         // оружие из инвентаря с уроном, итоговый бонус, броня
    ├── InventoryPanel.vue      // инвентарь + модалка «Купить из каталога» + произвольный предмет
    ├── MagicPanel.vue          // conditional: духи (редактируемые), ритуалы, заклички (read-only)
    └── NotesPanel.vue          // textarea
```

Табы: **Основное / Бой / Инвентарь / Магия (conditional) / Заметки**.

### UI: Level-up flow

```
src/features/level-up/
├── LevelUpView.vue
└── components/
    ├── RewardsSummary.vue
    ├── HitDiceRollStep.vue
    ├── SkillPickStep.vue
    ├── AbilityPickStep.vue
    └── StatBumpStep.vue
```

Логика:
1. При входе `targetLevel = level + 1`, `reward = LEVEL_REWARDS[targetLevel]`.
2. Автоматические награды (hitDice-ап с броском d6 и добавлением к maxHp, damageDice-ап) применяются сразу в `pendingPatch`.
3. Интерактивные шаги (skill/ability/stat) — последовательно, один экран = один выбор.
4. Итоговый экран «Было → стало» → `applyLevelUp`.
5. Если после применения XP хватает ещё на уровень — HeaderStrip снова показывает кнопку. Один экран = один уровень (без каскада в одном проходе).

## Что удаляется

- `src/data/classes/` (вся папка, заменяется на `classes.ts`)
- Все DW-шаги creation: `StepMoves.vue`, `StepBonds.vue`, `StepAlignment.vue`, `StepLook.vue`, `StepRace.vue`, старый `StepGear.vue` (имена могут отличаться — проверяется при имплементации)
- DW-компоненты in-game: `MovesTab.vue`, `BondsTab.vue`, `DebilitiesTab.vue`, всё связанное
- DW-шаги level-up: `LevelMoveStep.vue`, `LevelBondStep.vue` и аналогичные
- `src/stores/characters.test.ts`, `src/stores/creation.test.ts` (тесты не нужны)
- Из `Character`: `look, alignment, race, bonds, startingMoveIds, signatureWeapon, moveIds, debilities, maxLoad, damageDice`
- Типы: `Move, MoveType, Debilities, SignatureWeapon`

## Что остаётся

- `src/App.vue`, `src/main.ts`, `src/router/`, имена роутов неизменны
- `src/features/character-list/CharacterListView.vue` — проверяется и правится мелкими патчами если отображает DW-поля
- `src/components/ui/` — Reka-wrappers
- `src/assets/main.css`
- Сборка, конфиги, Obsidian-данные

## Риски и открытые вопросы

- **localStorage**: старые DW-персонажи станут невидимы (новый ключ). Согласовано с пользователем — ок для хобби-проекта.
- **`CharacterListView`**: может содержать мелкие поля от DW (damage dice строкой и т.п.), которые отвалятся по типам. Правим точечно при имплементации.
- **Названия способностей в id**: часть абилок WoD совпадает по смыслу с DW (Healing), но здесь — другие механики. Префиксов не используем, берём английские id напрямую из руководства; описания — из WoD-референса.
- **Магия**: реализуем как текстовые поля со структурой. Механика призыва/бросков магических атак (2к6+уровень) явно не автоматизируется — это zона мастера. В `MagicPanel` только учёт духов/ритуалов/закличек.

## Следующие шаги

После утверждения этой спецификации — переходим к writing-plans для создания детального плана имплементации с порядком шагов и чекпойнтами.
