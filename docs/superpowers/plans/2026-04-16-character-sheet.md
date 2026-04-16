# Dungeon World Character Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить мобильное Vue 3 + TS приложение — интерактивный листок персонажа Dungeon World (класс Fighter) с тремя режимами: список персонажей, создание, игра и повышение уровня.

**Architecture:** Feature-based структура (`src/features/*`). Route-per-mode: `/` → список, `/character/new` → мастер создания, `/character/:id` → игра, `/character/:id/levelup` → повышение. Данные в Pinia + localStorage (persist). Типы и игровые данные (Fighter) — статика в TypeScript-файлах.

**Tech Stack:** Vue 3, TypeScript, Vite, Pinia + pinia-plugin-persistedstate, Vue Router 4, Reka UI, Vitest + @vue/test-utils + happy-dom, Commissioner (Google Fonts) с `font-language-override: "BGR"`.

**Design tokens:**
```
--color-bg: #1a1208
--color-bg-dark: #0d0a04
--color-bg-elevated: #2a1f0a
--color-accent: #d4a853
--color-border: #8b6914
--color-text: #d4a853
--color-text-muted: #8b6914
--color-danger: #c0392b
```

---

## File Map

```
src/
├── types/
│   └── character.ts              # все интерфейсы
├── utils/
│   ├── character.ts              # statModifier, xpThreshold, calcMaxHp, calcMaxLoad
│   └── character.test.ts
├── data/
│   └── classes/
│       └── fighter.ts            # ClassData: ходы, снаряжение, расы, облики
├── stores/
│   ├── characters.ts             # список всех персонажей + CRUD
│   ├── characters.test.ts
│   ├── creation.ts               # шаг мастера + id черновика
│   └── creation.test.ts
├── router/
│   └── index.ts
├── components/ui/
│   ├── UiAccordion.vue           # обёртка над Reka AccordionRoot
│   └── UiTabs.vue                # обёртка над Reka TabsRoot
├── features/
│   ├── character-list/
│   │   └── CharacterListView.vue
│   ├── character-creation/
│   │   ├── CharacterCreationView.vue   # прогресс-бар + роутинг шагов
│   │   └── steps/
│   │       ├── StepIdentity.vue        # шаг 1: имя, внешность, раса, мировоззрение
│   │       ├── StepStats.vue           # шаг 2: распределение характеристик
│   │       ├── StepMoves.vue           # шаг 3: стартовые ходы
│   │       └── StepGear.vue            # шаг 4: снаряжение + финализация
│   ├── in-game/
│   │   ├── InGameView.vue              # корневой layout
│   │   └── components/
│   │       ├── GameHeader.vue          # имя, класс, уровень, урон, броня
│   │       ├── HpXpBlock.vue           # HP полоса + XP кружки
│   │       ├── StatsGrid.vue           # 6 статов + дебилити inline
│   │       ├── MovesTab.vue            # аккордеон ходов
│   │       ├── GearTab.vue             # список снаряжения + нагрузка
│   │       └── BondsTab.vue            # редактируемые связи
│   └── level-up/
│       ├── LevelUpView.vue
│       └── components/
│           ├── LevelStatStep.vue       # шаг 1: выбор характеристики
│           └── LevelMoveStep.vue       # шаг 2: выбор хода
├── assets/
│   └── main.css                  # CSS custom properties + глобальные стили
├── App.vue
└── main.ts
```

---

## Task 1: Scaffold проекта

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json` (генерируются Vite)
- Modify: `vite.config.ts` — добавить vitest config

- [ ] **Step 1: Создать проект в текущей директории**

```bash
cd /Users/karkleo/Documents/pro/character-sheet-v1
npm create vite@latest . -- --template vue-ts
# При запросе "Current directory is not empty" → выбери "Ignore files and continue"
# При запросе об удалении файлов → выбери "No"
```

- [ ] **Step 2: Установить зависимости**

```bash
npm install
npm install pinia pinia-plugin-persistedstate vue-router@4 reka-ui
npm install -D vitest @vue/test-utils happy-dom @vitest/coverage-v8
```

- [ ] **Step 3: Настроить vitest в vite.config.ts**

Замени содержимое `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 4: Обновить tsconfig.json — добавить path alias**

В `tsconfig.json` добавь в `compilerOptions`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 5: Очистить шаблонный код**

```bash
rm -rf src/components src/assets/vue.svg public/vite.svg
echo "" > src/style.css
```

Замени `src/App.vue`:
```vue
<template>
  <RouterView />
</template>
```

- [ ] **Step 6: Подключить Pinia и Router в main.ts**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const pinia = createPinia()
pinia.use(piniaPersistedstate)

createApp(App).use(pinia).use(router).mount('#app')
```

- [ ] **Step 7: Проверить что проект запускается**

```bash
npm run dev
```

Ожидаемо: пустая страница (белая), без ошибок в консоли.

- [ ] **Step 8: Коммит**

```bash
git init
git add -A
git commit -m "feat: scaffold vue3+ts project with pinia, router, vitest"
```

---

## Task 2: TypeScript типы + утилиты

**Files:**
- Create: `src/types/character.ts`
- Create: `src/utils/character.ts`
- Create: `src/utils/character.test.ts`

- [ ] **Step 1: Написать failing тесты для утилит**

Создай `src/utils/character.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { statModifier, xpThreshold, calcMaxHp, calcMaxLoad } from './character'

describe('statModifier', () => {
  it.each([
    [1, -3], [3, -3],
    [4, -2], [5, -2],
    [6, -1], [8, -1],
    [9, 0],  [11, 0],
    [12, 1], [15, 1],
    [16, 2], [17, 2],
    [18, 3],
  ])('stat %i → modifier %i', (stat, mod) => {
    expect(statModifier(stat)).toBe(mod)
  })
})

describe('xpThreshold', () => {
  it.each([
    [1, 8], [3, 10], [9, 16],
  ])('level %i → threshold %i', (level, threshold) => {
    expect(xpThreshold(level)).toBe(threshold)
  })
})

describe('calcMaxHp', () => {
  it('Fighter base 10 + CON modifier', () => {
    expect(calcMaxHp(10, 15)).toBe(11) // CON 15 → +1
    expect(calcMaxHp(10, 16)).toBe(12) // CON 16 → +2
    expect(calcMaxHp(10, 8)).toBe(9)   // CON 8  → -1
  })
})

describe('calcMaxLoad', () => {
  it('Fighter base 12 + STR modifier', () => {
    expect(calcMaxLoad(12, 16)).toBe(14) // STR 16 → +2
    expect(calcMaxLoad(12, 9)).toBe(12)  // STR 9  → 0
    expect(calcMaxLoad(12, 6)).toBe(11)  // STR 6  → -1
  })
})
```

- [ ] **Step 2: Запустить тесты — убедиться что FAIL**

```bash
npx vitest run src/utils/character.test.ts
```

Ожидаемо: `FAIL` — файл `character.ts` не существует.

- [ ] **Step 3: Написать утилиты**

Создай `src/utils/character.ts`:
```ts
export function statModifier(stat: number): number {
  if (stat <= 3) return -3
  if (stat <= 5) return -2
  if (stat <= 8) return -1
  if (stat <= 11) return 0
  if (stat <= 15) return 1
  if (stat <= 17) return 2
  return 3
}

export function xpThreshold(level: number): number {
  return level + 7
}

/** baseHp = класс-константа (Fighter = 10) */
export function calcMaxHp(baseHp: number, con: number): number {
  return baseHp + statModifier(con)
}

/** baseLoad = класс-константа (Fighter = 12) */
export function calcMaxLoad(baseLoad: number, str: number): number {
  return baseLoad + statModifier(str)
}
```

- [ ] **Step 4: Запустить тесты — убедиться что PASS**

```bash
npx vitest run src/utils/character.test.ts
```

Ожидаемо: все тесты зелёные.

- [ ] **Step 5: Создать типы**

Создай `src/types/character.ts`:
```ts
export type MoveType = 'starting' | 'advanced_2_5' | 'advanced_6_10'

export interface Move {
  id: string
  classId: string
  name: string
  description: string
  type: MoveType
  requiresId?: string   // ход-условие (должен быть взят раньше)
  replacesId?: string   // этот ход заменяет указанный
}

export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface Debilities {
  weak: boolean      // СИЛ -1
  shaky: boolean     // ЛОВ -1
  sick: boolean      // КОН -1
  stunned: boolean   // ИНТ -1
  confused: boolean  // МДР -1
  scarred: boolean   // ХАР -1
}

export interface InventoryItem {
  id: string
  name: string
  weight: number
  tags: string[]
  uses?: number
}

export type CharacterStatus = 'draft' | 'active'

export interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  // Создание (заполняются в мастере, не редактируются в игре)
  classId: string
  name: string
  look: string
  alignment: string
  race: string
  bonds: string[]           // шаблоны заполняются в игре
  startingMoveIds: string[]

  // Игровые данные
  stats: Stats
  currentHp: number
  maxHp: number
  armor: number
  xp: number
  level: number
  damageDice: string        // 'd10' для Fighter
  debilities: Debilities
  moveIds: string[]         // все взятые ходы (включая стартовые)
  inventory: InventoryItem[]
  coins: number
  maxLoad: number           // load вычисляется на лету: sum(inventory[].weight)
}

// Данные класса (статика)
export interface ClassData {
  id: string
  name: string
  damageDice: string
  baseHp: number
  baseLoad: number
  moves: Move[]
  startingGear: InventoryItem[][]   // группы вариантов на выбор
  alignments: Array<{ id: string; name: string; trigger: string }>
  races: Array<{ id: string; name: string; moveId: string }>
  looks: Array<{ category: string; options: string[] }>
  bondTemplates: string[]
}
```

- [ ] **Step 6: Коммит**

```bash
git add src/types/character.ts src/utils/character.ts src/utils/character.test.ts
git commit -m "feat: add character types and stat utility functions"
```

---

## Task 3: Данные класса Fighter

**Files:**
- Create: `src/data/classes/fighter.ts`

- [ ] **Step 1: Создать файл с данными Fighter**

Создай `src/data/classes/fighter.ts`:
```ts
import type { ClassData, Move } from '@/types/character'

const moves: Move[] = [
  // ── Стартовые ──────────────────────────────────────────
  {
    id: 'fighter_bend_bars',
    classId: 'fighter',
    name: 'Гнуть прутья, поднимать ворота',
    description:
      'Когда ты используешь чистую силу, чтобы уничтожить неодушевлённое препятствие, брось+СИЛ. На 10+: это сделано, без проблем. На 7–9: это сделано, но ГМ предложит цену: время, опасность или нежелательные последствия.',
    type: 'starting',
  },
  {
    id: 'fighter_signature_weapon',
    classId: 'fighter',
    name: 'Фирменное оружие',
    description:
      'У тебя есть особое оружие. Выбери основу: Меч, Топор, Молот, Копьё, Булава, Кинжал, Лук, Арбалет. Выбери вид (рукопашное, дальнобойное, двуручное) и одно улучшение: точное, устрашающее, парирующее, мощное, близкобойное, далекобойное.',
    type: 'starting',
  },
  {
    id: 'fighter_armored',
    classId: 'fighter',
    name: 'В доспехах',
    description:
      'Ты игнорируешь тэг «громоздкий» на доспехах, которые носишь.',
    type: 'starting',
  },
  // ── Расовые (входят в стартовые) ───────────────────────
  {
    id: 'fighter_race_human',
    classId: 'fighter',
    name: 'Человек: Наследие',
    description:
      'Однажды ты можешь потребовать, чтобы тебя судили по законам своей родины, а не по законам того места, где ты находишься. Раз в жизни.',
    type: 'starting',
  },
  {
    id: 'fighter_race_elf',
    classId: 'fighter',
    name: 'Эльф: Чужак',
    description:
      'Когда ты пытаешься вспомнить что-нибудь о людях, местах или вещах, брось+ИНТ. На 10+: ГМ предлагает три полезных факта. На 7–9: один факт. На провале ГМ задаёт тебе вопрос.',
    type: 'starting',
  },
  {
    id: 'fighter_race_dwarf',
    classId: 'fighter',
    name: 'Дварф: Дварфийская работа',
    description:
      'Когда ты оцениваешь строение, механизм или предмет дварфийского производства, брось+ИНТ. На 10+: ГМ говорит тебе его историю и лучший способ применить или сломать его. На 7–9: только одно.',
    type: 'starting',
  },
  // ── Продвинутые 2–5 ─────────────────────────────────────
  {
    id: 'fighter_merciless',
    classId: 'fighter',
    name: 'Беспощадный',
    description:
      'Когда ты наносишь урон, нанеси дополнительно d6 урона.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_armor_mastery',
    classId: 'fighter',
    name: 'Мастерство доспехов',
    description:
      'Когда ты делаешь свой ход и принимаешь урон, защита твоих доспехов удваивается против этой атаки.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_improved_weapon',
    classId: 'fighter',
    name: 'Улучшенное оружие',
    description:
      'Выбери одно дополнительное улучшение для своего Фирменного оружия.',
    type: 'advanced_2_5',
    requiresId: 'fighter_signature_weapon',
    replacesId: 'fighter_signature_weapon',
  },
  {
    id: 'fighter_iron_hide',
    classId: 'fighter',
    name: 'Железная шкура',
    description: 'Получи +1 броня.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_seeing_red',
    classId: 'fighter',
    name: 'Красная пелена',
    description:
      'Когда ты входишь в бой, брось+КОН. На 10+: выбери 2. На 7–9: выбери 1. Держи сосредоточенность; Держи инициативу; Держи самообладание.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_interrogator',
    classId: 'fighter',
    name: 'Допросчик',
    description:
      'Когда ты используешь угрозу насилия для получения информации, брось+ХАР. На 10+: они отвечают на три твоих вопроса. На 7–9: они отвечают на один вопрос.',
    type: 'advanced_2_5',
  },
  // ── Продвинутые 6–10 ────────────────────────────────────
  {
    id: 'fighter_unbreakable',
    classId: 'fighter',
    name: 'Несломимый',
    description:
      'Когда ты получаешь урон, сделай бросок+КОН. На 10+: игнорируй урон полностью. На 7–9: половину урона, округляя вниз.',
    type: 'advanced_6_10',
    requiresId: 'fighter_iron_hide',
  },
  {
    id: 'fighter_superior_warrior',
    classId: 'fighter',
    name: 'Превосходный воин',
    description:
      'Когда ты рубишь и рвёшь, при успехе на 12+ нанеси урон и выбери одно: предотврати ответный удар; перемести противника; вызови страх.',
    type: 'advanced_6_10',
  },
]

const fighter: ClassData = {
  id: 'fighter',
  name: 'Воин',
  damageDice: 'd10',
  baseHp: 10,    // + КОН-модификатор при создании
  baseLoad: 12,  // + СИЛ-модификатор при создании

  moves,

  alignments: [
    { id: 'good',    name: 'Доброе',    trigger: 'Защити кого-то более слабого от опасности' },
    { id: 'neutral', name: 'Нейтральное', trigger: 'Победи достойного противника' },
    { id: 'evil',    name: 'Злое',      trigger: 'Убей беззащитного врага' },
  ],

  races: [
    { id: 'human', name: 'Человек', moveId: 'fighter_race_human' },
    { id: 'elf',   name: 'Эльф',   moveId: 'fighter_race_elf' },
    { id: 'dwarf', name: 'Дварф',  moveId: 'fighter_race_dwarf' },
  ],

  looks: [
    { category: 'Глаза',   options: ['зоркие', 'жёсткие', 'дикие', 'мёртвые', 'умные'] },
    { category: 'Волосы',  options: ['бритые', 'кудрявые', 'нечёсаные', 'заплетённые', 'лысина'] },
    { category: 'Лицо',    options: ['изрезанное шрамами', 'суровое', 'простодушное', 'красивое', 'страшное'] },
    { category: 'Тело',    options: ['мускулистое', 'коренастое', 'тощее', 'огромное', 'гибкое'] },
    { category: 'Одежда',  options: ['доспехи', 'поношенный наряд', 'дорогая одежда', 'трофеи с врагов'] },
  ],

  bondTemplates: [
    '_____ спасли мою жизнь; я у них в долгу.',
    '_____ — единственный человек, которому я доверяю в бою.',
    '_____ моложе меня и неопытен; я должен защищать его.',
    '_____ знает моих врагов и помог мне против них.',
  ],

  // Снаряжение: каждый sub-array — группа вариантов (игрок выбирает один из каждой группы)
  startingGear: [
    // Группа 1: оружие
    [
      { id: 'sg_dungeon_rations', name: 'Дорожные пайки (5)', weight: 1, tags: ['расходник'] },
    ],
    // Группа 2: броня
    [
      { id: 'sg_chainmail',  name: 'Кольчуга (броня 1, 1 вес)',  weight: 1, tags: ['доспех', 'броня 1'] },
      { id: 'sg_scale_mail', name: 'Чешуйчатая (броня 2, 3 вес, громоздкая)', weight: 3, tags: ['доспех', 'броня 2', 'громоздкий'] },
    ],
    // Группа 3: доп. предметы
    [
      { id: 'sg_healing_potion', name: 'Зелье лечения', weight: 0, tags: ['расходник'] },
      { id: 'sg_antitoxin',      name: 'Антитоксин',   weight: 0, tags: ['расходник'] },
    ],
    // Группа 4: монеты (фиксировано)
    [
      { id: 'sg_coins', name: '10 монет', weight: 1, tags: ['монеты'] },
    ],
  ],
}

export default fighter
export { moves }
```

- [ ] **Step 2: Проверить что файл компилируется без ошибок**

```bash
npx tsc --noEmit
```

Ожидаемо: 0 ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/data/classes/fighter.ts
git commit -m "feat: add Fighter class data (moves, gear, races, looks)"
```

---

## Task 4: Pinia stores

**Files:**
- Create: `src/stores/characters.ts`
- Create: `src/stores/characters.test.ts`
- Create: `src/stores/creation.ts`
- Create: `src/stores/creation.test.ts`

- [ ] **Step 1: Написать тесты для characters store**

Создай `src/stores/characters.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCharactersStore } from './characters'
import type { Character } from '@/types/character'

const makeChar = (overrides: Partial<Character> = {}): Omit<Character, 'id' | 'createdAt'> => ({
  status: 'active',
  classId: 'fighter',
  name: 'Test Hero',
  look: '',
  alignment: 'good',
  race: 'human',
  bonds: [],
  startingMoveIds: [],
  stats: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 13 },
  currentHp: 16,
  maxHp: 16,
  armor: 1,
  xp: 0,
  level: 1,
  damageDice: 'd10',
  debilities: { weak: false, shaky: false, sick: false, stunned: false, confused: false, scarred: false },
  moveIds: ['fighter_bend_bars'],
  inventory: [],
  coins: 10,
  maxLoad: 14,
  ...overrides,
})

beforeEach(() => { setActivePinia(createPinia()) })

describe('useCharactersStore', () => {
  it('starts empty', () => {
    const store = useCharactersStore()
    expect(store.list).toHaveLength(0)
  })

  it('add() creates a character with id and createdAt', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    expect(store.list).toHaveLength(1)
    expect(char.id).toBeTruthy()
    expect(char.createdAt).toBeGreaterThan(0)
  })

  it('update() patches an existing character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    store.update(char.id, { currentHp: 5 })
    expect(store.list[0].currentHp).toBe(5)
  })

  it('remove() deletes a character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar())
    store.remove(char.id)
    expect(store.list).toHaveLength(0)
  })

  it('getById() finds a character', () => {
    const store = useCharactersStore()
    const char = store.add(makeChar({ name: 'Bilbo' }))
    expect(store.getById(char.id)?.name).toBe('Bilbo')
  })
})
```

- [ ] **Step 2: Запустить — убедиться в FAIL**

```bash
npx vitest run src/stores/characters.test.ts
```

Ожидаемо: `FAIL` — файл не существует.

- [ ] **Step 3: Написать characters store**

Создай `src/stores/characters.ts`:
```ts
import { defineStore } from 'pinia'
import type { Character } from '@/types/character'

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
  }),
  getters: {
    getById: (state) => (id: string) =>
      state.list.find((c) => c.id === id),
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
    update(id: string, patch: Partial<Character>) {
      const idx = this.list.findIndex((c) => c.id === id)
      if (idx !== -1) this.list[idx] = { ...this.list[idx], ...patch }
    },
    remove(id: string) {
      this.list = this.list.filter((c) => c.id !== id)
    },
  },
  persist: true,
})
```

- [ ] **Step 4: Запустить тесты — PASS**

```bash
npx vitest run src/stores/characters.test.ts
```

- [ ] **Step 5: Написать тесты для creation store**

Создай `src/stores/creation.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCreationStore } from './creation'

beforeEach(() => { setActivePinia(createPinia()) })

describe('useCreationStore', () => {
  it('starts at step 1 with no draft', () => {
    const store = useCreationStore()
    expect(store.step).toBe(1)
    expect(store.draftId).toBeNull()
  })

  it('setDraft() sets the draft id', () => {
    const store = useCreationStore()
    store.setDraft('abc-123')
    expect(store.draftId).toBe('abc-123')
  })

  it('nextStep() increments up to 4', () => {
    const store = useCreationStore()
    store.nextStep()
    expect(store.step).toBe(2)
    store.nextStep(); store.nextStep(); store.nextStep()
    expect(store.step).toBe(4) // не больше 4
  })

  it('reset() clears draft and step', () => {
    const store = useCreationStore()
    store.setDraft('abc')
    store.nextStep()
    store.reset()
    expect(store.draftId).toBeNull()
    expect(store.step).toBe(1)
  })
})
```

- [ ] **Step 6: Написать creation store**

Создай `src/stores/creation.ts`:
```ts
import { defineStore } from 'pinia'

export const useCreationStore = defineStore('creation', {
  state: () => ({
    draftId: null as string | null,
    step: 1,
  }),
  actions: {
    setDraft(id: string) {
      this.draftId = id
    },
    nextStep() {
      if (this.step < 4) this.step++
    },
    prevStep() {
      if (this.step > 1) this.step--
    },
    reset() {
      this.draftId = null
      this.step = 1
    },
  },
  persist: true,
})
```

- [ ] **Step 7: Запустить все тесты — PASS**

```bash
npx vitest run src/stores/
```

- [ ] **Step 8: Коммит**

```bash
git add src/stores/
git commit -m "feat: add characters and creation pinia stores with persistence"
```

---

## Task 5: Vue Router

**Files:**
- Create: `src/router/index.ts`

- [ ] **Step 1: Создать router**

Создай `src/router/index.ts`:
```ts
import { createRouter, createWebHistory } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/features/character-list/CharacterListView.vue'),
    },
    {
      path: '/character/new',
      component: () => import('@/features/character-creation/CharacterCreationView.vue'),
    },
    {
      path: '/character/:id',
      component: () => import('@/features/in-game/InGameView.vue'),
      beforeEnter: (to) => {
        // Защита: если персонаж не найден или draft → на главную
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status === 'draft') return '/'
      },
    },
    {
      path: '/character/:id/levelup',
      component: () => import('@/features/level-up/LevelUpView.vue'),
      beforeEnter: (to) => {
        const store = useCharactersStore()
        const char = store.getById(to.params.id as string)
        if (!char || char.status !== 'active') return '/'
      },
    },
  ],
})

export default router
```

- [ ] **Step 2: Создать заглушки для всех view-компонентов** (чтобы router не падал при импорте)

```bash
mkdir -p src/features/character-list
mkdir -p src/features/character-creation/steps
mkdir -p src/features/in-game/components
mkdir -p src/features/level-up/components
mkdir -p src/components/ui
```

Создай `src/features/character-list/CharacterListView.vue`:
```vue
<template><div>Character List</div></template>
```

Создай `src/features/character-creation/CharacterCreationView.vue`:
```vue
<template><div>Creation</div></template>
```

Создай `src/features/in-game/InGameView.vue`:
```vue
<template><div>In Game</div></template>
```

Создай `src/features/level-up/LevelUpView.vue`:
```vue
<template><div>Level Up</div></template>
```

- [ ] **Step 3: Проверить что app запускается и навигация работает**

```bash
npm run dev
```

Открой `http://localhost:5173` — должно показываться «Character List».  
Открой `http://localhost:5173/character/new` — должно показываться «Creation».  
Открой `http://localhost:5173/character/fake-id` — должно редиректить на `/`.

- [ ] **Step 4: Коммит**

```bash
git add src/router/ src/features/
git commit -m "feat: add vue router with route guards"
```

---

## Task 6: Глобальные стили

**Files:**
- Create/Modify: `src/assets/main.css`

- [ ] **Step 1: Создать CSS с custom properties и базовыми стилями**

Замени `src/assets/main.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Commissioner:wght@300;400;500;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #1a1208;
  --color-bg-dark: #0d0a04;
  --color-bg-elevated: #2a1f0a;
  --color-accent: #d4a853;
  --color-border: #8b6914;
  --color-text: #d4a853;
  --color-text-muted: #8b6914;
  --color-danger: #c0392b;

  --font-family: 'Commissioner', sans-serif;
  --border-radius: 2px;
}

html, body, #app {
  min-height: 100%;
  background: var(--color-bg-dark);
  color: var(--color-text);
}

body {
  font-family: var(--font-family);
  font-feature-settings: "locl" 1;
  font-language-override: "BGR";
  -webkit-font-smoothing: antialiased;
}

/* Контейнер контента — мобильная ширина */
.content-wrap {
  max-width: 480px;
  margin: 0 auto;
  background: var(--color-bg);
  min-height: 100dvh;
}

/* Кнопки */
.btn-primary {
  background: var(--color-border);
  color: var(--color-bg);
  border: none;
  padding: 10px 24px;
  font-family: var(--font-family);
  font-feature-settings: "locl" 1;
  font-language-override: "BGR";
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--border-radius);
  cursor: pointer;
  letter-spacing: 0.5px;
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: none;
  padding: 10px 16px;
  font-family: var(--font-family);
  font-size: 13px;
  cursor: pointer;
}

/* Текстовые метки */
.label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--color-text-muted);
}

/* Разделитель */
.divider {
  height: 1px;
  background: var(--color-border);
  opacity: 0.4;
}
```

- [ ] **Step 2: Проверить внешний вид**

```bash
npm run dev
```

Открой `http://localhost:5173` — фон должен быть тёмно-коричневым, текст золотой, шрифт Commissioner.

- [ ] **Step 3: Коммит**

```bash
git add src/assets/main.css
git commit -m "feat: add global styles with dark parchment palette and Commissioner font"
```

---

## Task 7: Character List View

**Files:**
- Modify: `src/features/character-list/CharacterListView.vue`

- [ ] **Step 1: Реализовать CharacterListView**

Замени `src/features/character-list/CharacterListView.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

const activeChars = computed(() => characters.list.filter(c => c.status === 'active'))
const draftChars = computed(() => characters.list.filter(c => c.status === 'draft'))

function openCharacter(id: string) {
  router.push(`/character/${id}`)
}

function resumeCreation(id: string) {
  creation.setDraft(id)
  router.push('/character/new')
}

function startNew() {
  creation.reset()
  router.push('/character/new')
}

function hpPercent(current: number, max: number) {
  return Math.max(0, Math.min(100, (current / max) * 100))
}
</script>

<template>
  <div class="content-wrap">
    <div class="list-header">
      <span class="label">Персонажи</span>
      <button class="btn-primary" @click="startNew">+ Новый</button>
    </div>

    <!-- Активные персонажи -->
    <div v-if="activeChars.length > 0" class="char-list">
      <button
        v-for="char in activeChars"
        :key="char.id"
        class="char-card"
        @click="openCharacter(char.id)"
      >
        <div class="char-card__top">
          <div>
            <div class="char-card__name">{{ char.name }}</div>
            <div class="label">{{ char.classId === 'fighter' ? 'Воин' : char.classId }} · Уровень {{ char.level }}</div>
          </div>
          <div class="char-card__hp">
            <span class="label">HP</span>
            <span>{{ char.currentHp }} / {{ char.maxHp }}</span>
          </div>
        </div>
        <div class="char-card__hp-bar">
          <div
            class="char-card__hp-fill"
            :style="{ width: hpPercent(char.currentHp, char.maxHp) + '%' }"
          />
        </div>
      </button>
    </div>

    <!-- Черновики -->
    <div v-if="draftChars.length > 0" class="draft-section">
      <div class="label" style="padding: 12px 16px 8px">Не завершены</div>
      <button
        v-for="char in draftChars"
        :key="char.id"
        class="char-card char-card--draft"
        @click="resumeCreation(char.id)"
      >
        <div class="char-card__name">{{ char.name || 'Без имени' }}</div>
        <div class="label">Продолжить создание →</div>
      </button>
    </div>

    <!-- Пусто -->
    <div v-if="activeChars.length === 0 && draftChars.length === 0" class="empty-state">
      <p>Нет персонажей.</p>
      <p class="label" style="margin-top: 8px">Нажми «+ Новый» чтобы начать</p>
    </div>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}
.char-list { display: flex; flex-direction: column; }
.char-card {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  padding: 14px 16px 10px;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  font-family: inherit;
}
.char-card:hover { background: var(--color-bg-elevated); }
.char-card--draft { opacity: 0.6; }
.char-card__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.char-card__name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.char-card__hp { text-align: right; font-size: 14px; }
.char-card__hp-bar { height: 4px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.char-card__hp-fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.draft-section { border-top: 1px solid var(--color-border); }
.empty-state { padding: 48px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
</style>
```

- [ ] **Step 2: Проверить в браузере**

```bash
npm run dev
```

Открой `http://localhost:5173` — пустой список с кнопкой «+ Новый». Нажми — должен переходить на `/character/new`.

- [ ] **Step 3: Коммит**

```bash
git add src/features/character-list/
git commit -m "feat: implement character list view"
```

---

## Task 8: Character Creation — shell + шаги

**Files:**
- Modify: `src/features/character-creation/CharacterCreationView.vue`
- Create: `src/features/character-creation/steps/StepIdentity.vue`
- Create: `src/features/character-creation/steps/StepStats.vue`
- Create: `src/features/character-creation/steps/StepMoves.vue`
- Create: `src/features/character-creation/steps/StepGear.vue`

- [ ] **Step 1: Реализовать shell мастера создания**

Замени `src/features/character-creation/CharacterCreationView.vue`:
```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { calcMaxHp, calcMaxLoad } from '@/utils/character'
import fighter from '@/data/classes/fighter'
import StepIdentity from './steps/StepIdentity.vue'
import StepStats from './steps/StepStats.vue'
import StepMoves from './steps/StepMoves.vue'
import StepGear from './steps/StepGear.vue'
import type { Character, Stats } from '@/types/character'

const router = useRouter()
const characters = useCharactersStore()
const creation = useCreationStore()

// Если есть draftId — загружаем существующий черновик, иначе создаём новый
onMounted(() => {
  if (!creation.draftId) {
    const draft = characters.add({
      status: 'draft',
      classId: 'fighter',
      name: '',
      look: '',
      alignment: '',
      race: '',
      bonds: [...fighter.bondTemplates],
      startingMoveIds: [],
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      currentHp: 0,
      maxHp: 0,
      armor: 0,
      xp: 0,
      level: 1,
      damageDice: fighter.damageDice,
      debilities: { weak: false, shaky: false, sick: false, stunned: false, confused: false, scarred: false },
      moveIds: [],
      inventory: [],
      coins: 0,
      maxLoad: 0,
    })
    creation.setDraft(draft.id)
  }
})

const draft = computed(() => characters.getById(creation.draftId ?? ''))

const stepComponents = [StepIdentity, StepStats, StepMoves, StepGear]
const currentStepComponent = computed(() => stepComponents[creation.step - 1])

function patch(data: Partial<Character>) {
  if (creation.draftId) characters.update(creation.draftId, data)
}

function next() {
  creation.nextStep()
}

function back() {
  if (creation.step === 1) {
    // Удалить черновик и вернуться на главную
    if (creation.draftId) characters.remove(creation.draftId)
    creation.reset()
    router.push('/')
  } else {
    creation.prevStep()
  }
}

function finish(gearPatch: Partial<Character>) {
  if (!creation.draftId || !draft.value) return
  const d = draft.value
  const maxHp = calcMaxHp(fighter.baseHp, d.stats.con)
  const maxLoad = calcMaxLoad(fighter.baseLoad, d.stats.str)
  // Стартовые ходы + расовый ход
  const raceMove = fighter.races.find(r => r.id === d.race)
  const allMoveIds = [...d.startingMoveIds]
  if (raceMove && !allMoveIds.includes(raceMove.moveId)) allMoveIds.push(raceMove.moveId)

  characters.update(creation.draftId, {
    ...gearPatch,
    maxHp,
    currentHp: maxHp,
    maxLoad,
    moveIds: allMoveIds,
    status: 'active',
  })
  const id = creation.draftId
  creation.reset()
  router.push(`/character/${id}`)
}
</script>

<template>
  <div class="content-wrap" v-if="draft">
    <!-- Прогресс-бар -->
    <div class="progress-bar">
      <div
        v-for="n in 4"
        :key="n"
        class="progress-bar__segment"
        :class="{ 'progress-bar__segment--done': n <= creation.step }"
      />
    </div>

    <!-- Шапка -->
    <div class="creation-header">
      <button class="btn-ghost" @click="back">← Назад</button>
      <span class="label">Шаг {{ creation.step }} из 4</span>
    </div>

    <!-- Текущий шаг -->
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
.progress-bar {
  display: flex;
  height: 3px;
  background: var(--color-bg-dark);
}
.progress-bar__segment {
  flex: 1;
  background: var(--color-border);
  opacity: 0.3;
  transition: opacity 0.2s;
}
.progress-bar__segment--done { opacity: 1; }
.creation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
}
</style>
```

- [ ] **Step 2: Создать StepIdentity**

Создай `src/features/character-creation/steps/StepIdentity.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

const name = ref(props.draft.name)
const selectedLooks = ref<Record<string, string>>(
  Object.fromEntries(fighter.looks.map(l => [l.category, '']))
)
const race = ref(props.draft.race)
const alignment = ref(props.draft.alignment)

const lookString = computed(() =>
  Object.values(selectedLooks.value).filter(Boolean).join(', ')
)

const canProceed = computed(() =>
  name.value.trim().length > 0 && race.value && alignment.value
)

function proceed() {
  emit('patch', {
    name: name.value.trim(),
    look: lookString.value,
    race: race.value,
    alignment: alignment.value,
  })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Личность</h2>

    <!-- Имя -->
    <div class="field">
      <label class="label">Имя</label>
      <input class="text-input" v-model="name" placeholder="Имя персонажа" maxlength="40" />
    </div>

    <!-- Внешность -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Внешность</div>
      <div v-for="look in fighter.looks" :key="look.category" class="look-group">
        <div class="label" style="margin-bottom: 6px; opacity: 0.6">{{ look.category }}</div>
        <div class="option-row">
          <button
            v-for="opt in look.options"
            :key="opt"
            class="option-chip"
            :class="{ 'option-chip--selected': selectedLooks[look.category] === opt }"
            @click="selectedLooks[look.category] = opt"
          >{{ opt }}</button>
        </div>
      </div>
    </div>

    <!-- Раса -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Раса</div>
      <div class="choice-list">
        <button
          v-for="r in fighter.races"
          :key="r.id"
          class="choice-item"
          :class="{ 'choice-item--selected': race === r.id }"
          @click="race = r.id"
        >
          <span class="choice-item__name">{{ r.name }}</span>
          <span class="choice-item__hint">+ход: {{ fighter.moves.find(m => m.id === r.moveId)?.name }}</span>
        </button>
      </div>
    </div>

    <!-- Мировоззрение -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">Мировоззрение</div>
      <div class="choice-list">
        <button
          v-for="a in fighter.alignments"
          :key="a.id"
          class="choice-item"
          :class="{ 'choice-item--selected': alignment === a.id }"
          @click="alignment = a.id"
        >
          <span class="choice-item__name">{{ a.name }}</span>
          <span class="choice-item__hint">XP: {{ a.trigger }}</span>
        </button>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canProceed" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 8px; }
.text-input {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  font-size: 16px;
  padding: 10px 12px;
  border-radius: var(--border-radius);
  width: 100%;
}
.text-input::placeholder { color: var(--color-text-muted); opacity: 0.5; }
.text-input:focus { outline: none; border-color: var(--color-accent); }
.look-group { margin-bottom: 10px; }
.option-row { display: flex; flex-wrap: wrap; gap: 6px; }
.option-chip {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 5px 10px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.option-chip--selected { border-color: var(--color-accent); color: var(--color-accent); }
.choice-list { display: flex; flex-direction: column; gap: 6px; }
.choice-item {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 12px;
  text-align: left;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.choice-item--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.choice-item__name { font-size: 14px; font-weight: 600; }
.choice-item__hint { font-size: 11px; color: var(--color-text-muted); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 3: Создать StepStats**

Создай `src/features/character-creation/steps/StepStats.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

// Стандартные наборы чисел DW (распределяешь по 6 характеристикам)
const ARRAYS = [16, 15, 13, 12, 9, 8]

const statKeys: Array<keyof Stats> = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const statNames: Record<keyof Stats, string> = {
  str: 'СИЛ', dex: 'ЛОВ', con: 'КОН', int: 'ИНТ', wis: 'МДР', cha: 'ХАР',
}

// assigned[statKey] = значение из ARRAYS | null
const assigned = ref<Record<keyof Stats, number | null>>({
  str: null, dex: null, con: null, int: null, wis: null, cha: null,
})

const usedValues = computed(() => Object.values(assigned.value).filter(v => v !== null) as number[])
const availableValues = computed(() => ARRAYS.filter(v => !usedValues.value.includes(v)))
const allAssigned = computed(() => usedValues.value.length === 6)

// Выбранный stat для присваивания
const selectedStat = ref<keyof Stats | null>(null)

function selectStat(stat: keyof Stats) {
  selectedStat.value = selectedStat.value === stat ? null : stat
}

function assignValue(val: number) {
  if (!selectedStat.value) return
  assigned.value[selectedStat.value] = val
  selectedStat.value = null
}

function clearStat(stat: keyof Stats) {
  assigned.value[stat] = null
}

function proceed() {
  const stats = Object.fromEntries(
    statKeys.map(k => [k, assigned.value[k] ?? 0])
  ) as Stats
  emit('patch', { stats })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Характеристики</h2>
    <p class="hint">Выбери характеристику → присвой ей значение из списка</p>

    <!-- Статы -->
    <div class="stats-grid">
      <button
        v-for="key in statKeys"
        :key="key"
        class="stat-box"
        :class="{
          'stat-box--selected': selectedStat === key,
          'stat-box--filled': assigned[key] !== null,
        }"
        @click="assigned[key] !== null ? clearStat(key) : selectStat(key)"
      >
        <span class="label">{{ statNames[key] }}</span>
        <span class="stat-box__value">{{ assigned[key] ?? '—' }}</span>
        <span class="stat-box__mod" v-if="assigned[key] !== null">
          {{ statModifier(assigned[key]!) >= 0 ? '+' : '' }}{{ statModifier(assigned[key]!) }}
        </span>
      </button>
    </div>

    <!-- Доступные значения -->
    <div class="field">
      <div class="label" style="margin-bottom: 8px">
        {{ selectedStat ? `Присвоить к ${statNames[selectedStat]}:` : 'Доступные значения' }}
      </div>
      <div class="values-row">
        <button
          v-for="val in availableValues"
          :key="val"
          class="value-chip"
          :class="{ 'value-chip--active': selectedStat !== null }"
          @click="assignValue(val)"
        >{{ val }}</button>
        <span v-if="availableValues.length === 0" class="label">Все распределены</span>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!allAssigned" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-box {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 8px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-box--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.stat-box--filled { border-color: var(--color-border); }
.stat-box__value { font-size: 24px; font-weight: 700; }
.stat-box__mod { font-size: 12px; color: var(--color-text-muted); }
.values-row { display: flex; gap: 8px; flex-wrap: wrap; }
.value-chip {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 8px 14px;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: default;
}
.value-chip--active { cursor: pointer; color: var(--color-accent); border-color: var(--color-accent); }
.field { display: flex; flex-direction: column; }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 4: Создать StepMoves**

Создай `src/features/character-creation/steps/StepMoves.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character, Move } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  next: []
}>()

const REQUIRED_COUNT = 2 // Fighter выбирает 2 стартовых хода (плюс Фирменное оружие и В доспехах — автоматически)

// Ходы, доступные для выбора в мастере (стартовые, не расовые)
const selectableMoves = computed(() =>
  fighter.moves.filter(m => m.type === 'starting' && !m.id.startsWith('fighter_race_'))
)

const selected = ref<string[]>([...props.draft.startingMoveIds])

function toggle(move: Move) {
  const idx = selected.value.indexOf(move.id)
  if (idx !== -1) {
    selected.value.splice(idx, 1)
  } else if (selected.value.length < REQUIRED_COUNT) {
    selected.value.push(move.id)
  }
}

const expanded = ref<string | null>(null)
function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
}

const canProceed = computed(() => selected.value.length === REQUIRED_COUNT)

function proceed() {
  emit('patch', { startingMoveIds: [...selected.value] })
  emit('next')
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Стартовые ходы</h2>
    <p class="hint">Выбери {{ REQUIRED_COUNT }} из {{ selectableMoves.length }} ходов ({{ selected.length }}/{{ REQUIRED_COUNT }})</p>
    <p class="hint" style="margin-top: -12px">«Фирменное оружие» и «В доспехах» даются автоматически</p>

    <div class="moves-list">
      <div
        v-for="move in selectableMoves"
        :key="move.id"
        class="move-item"
        :class="{
          'move-item--selected': selected.includes(move.id),
          'move-item--disabled': !selected.includes(move.id) && selected.length >= REQUIRED_COUNT,
        }"
      >
        <div class="move-item__header" @click="toggle(move)">
          <div class="move-item__check">
            <span v-if="selected.includes(move.id)">✓</span>
          </div>
          <span class="move-item__name">{{ move.name }}</span>
          <button class="move-item__expand" @click.stop="toggleExpand(move.id)">
            {{ expanded === move.id ? '▲' : '▼' }}
          </button>
        </div>
        <div v-if="expanded === move.id" class="move-item__desc">
          {{ move.description }}
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!canProceed" @click="proceed">Далее →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.moves-list { display: flex; flex-direction: column; gap: 6px; }
.move-item { border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; }
.move-item--selected { border-color: var(--color-accent); }
.move-item--disabled { opacity: 0.4; }
.move-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--color-bg-elevated);
}
.move-item--selected .move-item__header { background: var(--color-bg-elevated); }
.move-item__check {
  width: 18px;
  height: 18px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-accent);
  flex-shrink: 0;
}
.move-item--selected .move-item__check { border-color: var(--color-accent); }
.move-item__name { flex: 1; font-size: 14px; font-weight: 600; }
.move-item__expand { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 10px; }
.move-item__desc { padding: 10px 12px; font-size: 12px; color: var(--color-text-muted); line-height: 1.6; border-top: 1px solid var(--color-border); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 5: Создать StepGear**

Создай `src/features/character-creation/steps/StepGear.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import fighter from '@/data/classes/fighter'
import type { Character, InventoryItem } from '@/types/character'

const props = defineProps<{ draft: Character }>()
const emit = defineEmits<{
  patch: [data: Partial<Character>]
  finish: [data: Partial<Character>]
}>()

// Для каждой группы снаряжения — выбранный индекс (null = не выбрано)
// Группа с одним предметом — автовыбор
const selections = ref<(number | null)[]>(
  fighter.startingGear.map(group => group.length === 1 ? 0 : null)
)

const allSelected = computed(() =>
  selections.value.every(s => s !== null)
)

const finalInventory = computed((): InventoryItem[] =>
  selections.value.flatMap((idx, groupIdx) =>
    idx !== null ? [fighter.startingGear[groupIdx][idx]] : []
  )
)

function select(groupIdx: number, itemIdx: number) {
  selections.value[groupIdx] = itemIdx
}

function finish() {
  emit('finish', {
    inventory: finalInventory.value,
    coins: 10,
    armor: finalInventory.value
      .flatMap(i => i.tags)
      .reduce((acc, tag) => {
        const m = tag.match(/^броня (\d+)$/)
        return m ? acc + parseInt(m[1]) : acc
      }, 0),
  })
}
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Снаряжение</h2>
    <p class="hint">Выбери по одному варианту из каждой группы</p>

    <div class="gear-groups">
      <div
        v-for="(group, gIdx) in fighter.startingGear"
        :key="gIdx"
        class="gear-group"
      >
        <!-- Группа из одного предмета — автовыбрана -->
        <div v-if="group.length === 1" class="gear-auto">
          <span class="label" style="opacity:.5">Автоматически</span>
          <span class="gear-auto__name">{{ group[0].name }}</span>
        </div>
        <!-- Группа с выбором -->
        <div v-else class="choice-list">
          <button
            v-for="(item, iIdx) in group"
            :key="item.id"
            class="choice-item"
            :class="{ 'choice-item--selected': selections[gIdx] === iIdx }"
            @click="select(gIdx, iIdx)"
          >
            <span class="choice-item__name">{{ item.name }}</span>
            <span class="choice-item__hint">вес {{ item.weight }}, {{ item.tags.join(', ') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="step-footer">
      <button class="btn-primary" :disabled="!allSelected" @click="finish">Создать персонажа →</button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 20px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.gear-groups { display: flex; flex-direction: column; gap: 16px; }
.gear-group {}
.gear-auto { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--border-radius); opacity: 0.7; }
.gear-auto__name { font-size: 14px; }
.choice-list { display: flex; flex-direction: column; gap: 6px; }
.choice-item {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 12px;
  text-align: left;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.choice-item--selected { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.choice-item__name { font-size: 14px; font-weight: 600; }
.choice-item__hint { font-size: 11px; color: var(--color-text-muted); }
.step-footer { display: flex; justify-content: flex-end; padding-top: 8px; }
</style>
```

- [ ] **Step 6: Проверить весь флоу создания в браузере**

```bash
npm run dev
```

Пройди полный флоу: `/` → «+ Новый» → 4 шага → должен попасть на `/character/:id` (пока заглушка «In Game»).

- [ ] **Step 7: Коммит**

```bash
git add src/features/character-creation/
git commit -m "feat: implement 4-step character creation wizard"
```

---

## Task 9: In-Game View

**Files:**
- Modify: `src/features/in-game/InGameView.vue`
- Create: `src/features/in-game/components/GameHeader.vue`
- Create: `src/features/in-game/components/HpXpBlock.vue`
- Create: `src/features/in-game/components/StatsGrid.vue`
- Create: `src/features/in-game/components/MovesTab.vue`
- Create: `src/features/in-game/components/GearTab.vue`
- Create: `src/features/in-game/components/BondsTab.vue`

- [ ] **Step 1: Реализовать InGameView**

Замени `src/features/in-game/InGameView.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { xpThreshold } from '@/utils/character'
import GameHeader from './components/GameHeader.vue'
import HpXpBlock from './components/HpXpBlock.vue'
import StatsGrid from './components/StatsGrid.vue'
import MovesTab from './components/MovesTab.vue'
import GearTab from './components/GearTab.vue'
import BondsTab from './components/BondsTab.vue'
import type { Character } from '@/types/character'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

function patch(data: Partial<Character>) {
  characters.update(id.value, data)
}

const canLevelUp = computed(() =>
  char.value ? char.value.xp >= xpThreshold(char.value.level) : false
)

const activeTab = ref<'moves' | 'gear' | 'bonds'>('moves')
</script>

<template>
  <div v-if="char" class="content-wrap">
    <!-- Кнопка Level Up (только при заполненном XP) -->
    <div v-if="canLevelUp" class="levelup-banner">
      <span>Достаточно опыта для повышения уровня!</span>
      <button class="btn-primary" @click="router.push(`/character/${id}/levelup`)">
        Повысить уровень ↑
      </button>
    </div>

    <GameHeader :char="char" @back="router.push('/')" />
    <HpXpBlock :char="char" @patch="patch" />
    <StatsGrid :char="char" @patch="patch" />

    <!-- Sticky табы -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'moves' }"
        @click="activeTab = 'moves'"
      >Ходы</button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'gear' }"
        @click="activeTab = 'gear'"
      >Снаряжение</button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'bonds' }"
        @click="activeTab = 'bonds'"
      >Связи</button>
    </div>

    <MovesTab v-if="activeTab === 'moves'" :char="char" />
    <GearTab v-if="activeTab === 'gear'" :char="char" @patch="patch" />
    <BondsTab v-if="activeTab === 'bonds'" :char="char" @patch="patch" />
  </div>
</template>

<style scoped>
.levelup-banner {
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-accent);
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-dark);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab {
  flex: 1;
  padding: 12px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
</style>
```

- [ ] **Step 2: Создать GameHeader**

Создай `src/features/in-game/components/GameHeader.vue`:
```vue
<script setup lang="ts">
import type { Character } from '@/types/character'

defineProps<{ char: Character }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <div class="header">
    <button class="btn-ghost" @click="$emit('back')">← Список</button>
    <div class="header__center">
      <div class="label">Воин · Уровень {{ char.level }}</div>
      <div class="header__name">{{ char.name }}</div>
    </div>
    <div class="header__right">
      <div class="label">{{ char.damageDice }}</div>
      <div class="label">броня {{ char.armor }}</div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
.header__center { text-align: center; }
.header__name { font-size: 18px; font-weight: 700; }
.header__right { text-align: right; }
</style>
```

- [ ] **Step 3: Создать HpXpBlock**

Создай `src/features/in-game/components/HpXpBlock.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { xpThreshold } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

const hpPercent = computed(() =>
  Math.max(0, Math.min(100, (props.char.currentHp / props.char.maxHp) * 100))
)

const threshold = computed(() => xpThreshold(props.char.level))

function changeHp(delta: number) {
  const newHp = Math.max(0, Math.min(props.char.maxHp, props.char.currentHp + delta))
  emit('patch', { currentHp: newHp })
}

function toggleXp(idx: number) {
  // Кружки 0..threshold-1: клик на idx → xp = idx+1 если не отмечен, idx если отмечен
  const newXp = props.char.xp === idx + 1 ? idx : idx + 1
  emit('patch', { xp: Math.min(newXp, threshold.value) })
}
</script>

<template>
  <div class="block">
    <!-- HP -->
    <div class="hp-section">
      <div class="label" style="margin-bottom: 6px">Хиты</div>
      <div class="hp-row">
        <button class="hp-btn" @click="changeHp(-1)">−</button>
        <div class="hp-numbers">
          <span class="hp-current">{{ char.currentHp }}</span>
          <span class="hp-sep">/</span>
          <span class="hp-max">{{ char.maxHp }}</span>
        </div>
        <button class="hp-btn" @click="changeHp(+1)">+</button>
      </div>
      <div class="hp-bar">
        <div class="hp-bar__fill" :style="{ width: hpPercent + '%' }" />
      </div>
    </div>

    <div class="divider-v" />

    <!-- XP -->
    <div class="xp-section">
      <div class="label" style="margin-bottom: 6px">Опыт ({{ char.xp }}/{{ threshold }})</div>
      <div class="xp-circles">
        <button
          v-for="i in threshold"
          :key="i"
          class="xp-circle"
          :class="{ 'xp-circle--filled': i <= char.xp }"
          @click="toggleXp(i - 1)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  align-items: flex-start;
}
.hp-section { flex: 1; }
.hp-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.hp-btn {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.hp-numbers { display: flex; align-items: baseline; gap: 4px; }
.hp-current { font-size: 28px; font-weight: 700; }
.hp-sep { color: var(--color-text-muted); }
.hp-max { font-size: 16px; color: var(--color-text-muted); }
.hp-bar { height: 5px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.hp-bar__fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.divider-v { width: 1px; background: var(--color-border); opacity: 0.3; align-self: stretch; }
.xp-section { flex: 1; }
.xp-circles { display: flex; flex-wrap: wrap; gap: 5px; }
.xp-circle {
  width: 14px;
  height: 14px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: none;
  cursor: pointer;
}
.xp-circle--filled { background: var(--color-accent); border-color: var(--color-accent); }
</style>
```

- [ ] **Step 4: Создать StatsGrid**

Создай `src/features/in-game/components/StatsGrid.vue`:
```vue
<script setup lang="ts">
import type { Character, Debilities, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

interface StatMeta {
  key: keyof Stats
  label: string
  debilityKey: keyof Debilities
  debilityName: string
}

const stats: StatMeta[] = [
  { key: 'str', label: 'СИЛ', debilityKey: 'weak',     debilityName: 'Слабый' },
  { key: 'dex', label: 'ЛОВ', debilityKey: 'shaky',    debilityName: 'Нестабильный' },
  { key: 'con', label: 'КОН', debilityKey: 'sick',      debilityName: 'Больной' },
  { key: 'int', label: 'ИНТ', debilityKey: 'stunned',   debilityName: 'Оглушённый' },
  { key: 'wis', label: 'МДР', debilityKey: 'confused',  debilityName: 'Растерянный' },
  { key: 'cha', label: 'ХАР', debilityKey: 'scarred',   debilityName: 'Изуродованный' },
]

function toggleDebility(key: keyof Debilities) {
  emit('patch', {
    debilities: {
      ...props.char.debilities,
      [key]: !props.char.debilities[key],
    },
  })
}

function effectiveMod(statKey: keyof Stats, debKey: keyof Debilities): number {
  const base = statModifier(props.char.stats[statKey])
  return props.char.debilities[debKey] ? base - 1 : base
}
</script>

<template>
  <div class="stats-wrap">
    <div class="label" style="margin-bottom: 8px">Характеристики</div>
    <div class="stats-grid">
      <button
        v-for="s in stats"
        :key="s.key"
        class="stat-card"
        :class="{ 'stat-card--debility': char.debilities[s.debilityKey] }"
        @click="toggleDebility(s.debilityKey)"
      >
        <div class="label">{{ s.label }}</div>
        <div class="stat-card__value">{{ char.stats[s.key] }}</div>
        <div
          class="stat-card__mod"
          :class="{ 'stat-card__mod--reduced': char.debilities[s.debilityKey] }"
        >
          {{ effectiveMod(s.key, s.debilityKey) >= 0 ? '+' : '' }}{{ effectiveMod(s.key, s.debilityKey) }}
        </div>
        <div v-if="char.debilities[s.debilityKey]" class="stat-card__debility-name">
          {{ s.debilityName }}
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.stats-wrap { padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.stat-card {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 8px 6px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-card--debility { border-color: var(--color-danger); background: rgba(192,57,43,0.08); }
.stat-card__value { font-size: 22px; font-weight: 700; }
.stat-card__mod { font-size: 12px; color: var(--color-text-muted); }
.stat-card__mod--reduced { color: var(--color-danger); text-decoration: line-through; }
.stat-card__debility-name { font-size: 8px; color: var(--color-danger); text-transform: uppercase; letter-spacing: 0.5px; }
</style>
```

- [ ] **Step 5: Создать MovesTab**

Создай `src/features/in-game/components/MovesTab.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, Move } from '@/types/character'
import fighter from '@/data/classes/fighter'

const props = defineProps<{ char: Character }>()

const charMoves = computed((): Move[] =>
  props.char.moveIds
    .map(id => fighter.moves.find(m => m.id === id))
    .filter((m): m is Move => m !== undefined)
)

const expanded = ref<string | null>(charMoves.value[0]?.id ?? null)
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}
</script>

<template>
  <div class="tab-content">
    <div v-if="charMoves.length === 0" class="empty">Нет ходов</div>
    <div v-for="move in charMoves" :key="move.id" class="move-item">
      <button class="move-item__header" @click="toggle(move.id)">
        <span class="move-item__name">{{ move.name }}</span>
        <span class="move-item__chevron">{{ expanded === move.id ? '▲' : '▼' }}</span>
      </button>
      <div v-if="expanded === move.id" class="move-item__desc">
        {{ move.description }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding-bottom: 24px; }
.empty { padding: 24px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.move-item { border-bottom: 1px solid var(--color-border); }
.move-item__header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.move-item__header:hover { background: var(--color-bg-elevated); }
.move-item__chevron { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; }
.move-item__desc { padding: 0 16px 14px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; }
</style>
```

- [ ] **Step 6: Создать GearTab**

Создай `src/features/in-game/components/GearTab.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

const currentLoad = computed(() =>
  props.char.inventory.reduce((sum, item) => sum + item.weight, 0)
)

const loadPercent = computed(() =>
  Math.min(100, (currentLoad.value / props.char.maxLoad) * 100)
)

function removeItem(id: string) {
  emit('patch', { inventory: props.char.inventory.filter(i => i.id !== id) })
}

function useItem(id: string) {
  emit('patch', {
    inventory: props.char.inventory.map(item =>
      item.id === id && item.uses !== undefined
        ? { ...item, uses: Math.max(0, item.uses - 1) }
        : item
    ).filter(item => item.uses === undefined || item.uses > 0),
  })
}
</script>

<template>
  <div class="tab-content">
    <!-- Нагрузка -->
    <div class="load-bar-wrap">
      <div class="load-label">
        <span class="label">Нагрузка</span>
        <span class="label">{{ currentLoad }} / {{ char.maxLoad }}</span>
      </div>
      <div class="load-bar">
        <div
          class="load-bar__fill"
          :style="{ width: loadPercent + '%' }"
          :class="{ 'load-bar__fill--over': currentLoad > char.maxLoad }"
        />
      </div>
    </div>

    <!-- Список предметов -->
    <div v-if="char.inventory.length === 0" class="empty">Снаряжение отсутствует</div>
    <div v-for="item in char.inventory" :key="item.id" class="item-row">
      <div class="item-info">
        <div class="item-name">{{ item.name }}</div>
        <div class="label">вес {{ item.weight }}{{ item.uses !== undefined ? ` · осталось ${item.uses}` : '' }}</div>
      </div>
      <div class="item-actions">
        <button v-if="item.uses !== undefined" class="action-btn" @click="useItem(item.id)">Использовать</button>
        <button class="action-btn action-btn--danger" @click="removeItem(item.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding-bottom: 24px; }
.load-bar-wrap { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.load-label { display: flex; justify-content: space-between; margin-bottom: 6px; }
.load-bar { height: 5px; background: var(--color-bg-elevated); border-radius: 2px; overflow: hidden; }
.load-bar__fill { height: 100%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s; }
.load-bar__fill--over { background: var(--color-danger); }
.empty { padding: 24px 16px; text-align: center; color: var(--color-text-muted); font-size: 14px; }
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
.item-name { font-size: 14px; margin-bottom: 2px; }
.item-actions { display: flex; gap: 8px; }
.action-btn {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-radius: var(--border-radius);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.action-btn--danger { color: var(--color-danger); border-color: var(--color-danger); }
</style>
```

- [ ] **Step 7: Создать BondsTab**

Создай `src/features/in-game/components/BondsTab.vue`:
```vue
<script setup lang="ts">
import type { Character } from '@/types/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [data: Partial<Character>] }>()

function updateBond(idx: number, value: string) {
  const bonds = [...props.char.bonds]
  bonds[idx] = value
  emit('patch', { bonds })
}
</script>

<template>
  <div class="tab-content">
    <div class="hint">Заполни связи с другими персонажами</div>
    <div v-for="(bond, idx) in char.bonds" :key="idx" class="bond-row">
      <textarea
        class="bond-input"
        :value="bond"
        rows="2"
        @input="updateBond(idx, ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
  </div>
</template>

<style scoped>
.tab-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; padding-bottom: 24px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.bond-row {}
.bond-input {
  width: 100%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: inherit;
  font-feature-settings: "locl" 1;
  font-language-override: "BGR";
  font-size: 13px;
  padding: 10px 12px;
  border-radius: var(--border-radius);
  resize: none;
  line-height: 1.5;
}
.bond-input:focus { outline: none; border-color: var(--color-accent); }
</style>
```

- [ ] **Step 8: Проверить игровой экран в браузере**

Создай персонажа через мастер и проверь:
- Все статы отображаются корректно
- Клик по стату переключает дебилити (красная рамка, модификатор -1)
- HP кнопки +/− работают
- XP кружки кликаются
- Табы переключаются между Ходы / Снаряжение / Связи
- Связи редактируются

- [ ] **Step 9: Коммит**

```bash
git add src/features/in-game/
git commit -m "feat: implement in-game view with stats, HP/XP, moves, gear, bonds"
```

---

## Task 10: Level Up

**Files:**
- Modify: `src/features/level-up/LevelUpView.vue`
- Create: `src/features/level-up/components/LevelStatStep.vue`
- Create: `src/features/level-up/components/LevelMoveStep.vue`

- [ ] **Step 1: Реализовать LevelUpView**

Замени `src/features/level-up/LevelUpView.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { calcMaxHp } from '@/utils/character'
import fighter from '@/data/classes/fighter'
import LevelStatStep from './components/LevelStatStep.vue'
import LevelMoveStep from './components/LevelMoveStep.vue'
import type { Character, Stats } from '@/types/character'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

const step = ref<1 | 2>(1)
const chosenStat = ref<keyof Stats | null>(null)

function selectStat(stat: keyof Stats) {
  chosenStat.value = stat
  step.value = 2
}

function finish(moveId: string) {
  if (!char.value || !chosenStat.value) return
  const newStatVal = char.value.stats[chosenStat.value] + 1
  const newStats = { ...char.value.stats, [chosenStat.value]: newStatVal }

  // Пересчёт maxHp если КОН поднялась выше порога
  const newMaxHp = chosenStat.value === 'con'
    ? calcMaxHp(fighter.baseHp, newStatVal) + (char.value.level) // +1 hp за уровень сверху базы
    : char.value.maxHp

  // Если ход заменяет другой — убрать старый
  const move = fighter.moves.find(m => m.id === moveId)
  let newMoveIds = [...char.value.moveIds]
  if (move?.replacesId) newMoveIds = newMoveIds.filter(id => id !== move.replacesId)
  if (!newMoveIds.includes(moveId)) newMoveIds.push(moveId)

  characters.update(id.value, {
    stats: newStats,
    maxHp: newMaxHp,
    level: char.value.level + 1,
    xp: 0,
    moveIds: newMoveIds,
  })
  router.push(`/character/${id.value}`)
}
</script>

<template>
  <div v-if="char" class="content-wrap">
    <div class="lu-header">
      <button class="btn-ghost" @click="router.push(`/character/${id}`)">← Назад</button>
      <div>
        <div class="label">Повышение уровня</div>
        <div style="font-size: 16px; font-weight: 700;">Уровень {{ char.level }} → {{ char.level + 1 }}</div>
      </div>
      <div class="label" style="text-align: right">Шаг {{ step }}/2</div>
    </div>

    <LevelStatStep
      v-if="step === 1"
      :char="char"
      @select="selectStat"
    />

    <LevelMoveStep
      v-if="step === 2"
      :char="char"
      @finish="finish"
    />
  </div>
</template>

<style scoped>
.lu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}
</style>
```

- [ ] **Step 2: Создать LevelStatStep**

Создай `src/features/level-up/components/LevelStatStep.vue`:
```vue
<script setup lang="ts">
import type { Character, Stats } from '@/types/character'
import { statModifier } from '@/utils/character'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ select: [stat: keyof Stats] }>()

interface StatMeta { key: keyof Stats; label: string }
const stats: StatMeta[] = [
  { key: 'str', label: 'СИЛ' }, { key: 'dex', label: 'ЛОВ' },
  { key: 'con', label: 'КОН' }, { key: 'int', label: 'ИНТ' },
  { key: 'wis', label: 'МДР' }, { key: 'cha', label: 'ХАР' },
]
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Повысь характеристику</h2>
    <p class="hint">Выбери одну характеристику. Она увеличится на 1.</p>
    <div class="stats-grid">
      <button
        v-for="s in stats"
        :key="s.key"
        class="stat-card"
        @click="$emit('select', s.key)"
      >
        <div class="label">{{ s.label }}</div>
        <div class="stat-card__now">{{ char.stats[s.key] }}</div>
        <div class="stat-card__arrow">↓</div>
        <div class="stat-card__next">{{ char.stats[s.key] + 1 }}</div>
        <div class="stat-card__mod">
          {{ statModifier(char.stats[s.key] + 1) >= 0 ? '+' : '' }}{{ statModifier(char.stats[s.key] + 1) }}
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-card {
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 6px;
  text-align: center;
  border-radius: var(--border-radius);
  font-family: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.stat-card:hover { border-color: var(--color-accent); background: var(--color-bg-elevated); }
.stat-card__now { font-size: 18px; color: var(--color-text-muted); }
.stat-card__arrow { font-size: 10px; color: var(--color-text-muted); }
.stat-card__next { font-size: 22px; font-weight: 700; }
.stat-card__mod { font-size: 11px; color: var(--color-text-muted); }
</style>
```

- [ ] **Step 3: Создать LevelMoveStep**

Создай `src/features/level-up/components/LevelMoveStep.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, Move } from '@/types/character'
import fighter from '@/data/classes/fighter'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ finish: [moveId: string] }>()

const moveType = computed(() =>
  props.char.level < 6 ? 'advanced_2_5' : 'advanced_6_10'
)

const availableMoves = computed((): Move[] =>
  fighter.moves.filter(m => {
    if (m.type !== moveType.value) return false
    if (props.char.moveIds.includes(m.id)) return false // уже взят
    return true
  })
)

function isLocked(move: Move): boolean {
  if (!move.requiresId) return false
  return !props.char.moveIds.includes(move.requiresId)
}

const expanded = ref<string | null>(null)
</script>

<template>
  <div class="step-wrap">
    <h2 class="step-title">Выбери новый ход</h2>
    <p class="hint">Ходы с серым фоном недоступны — не выполнено условие.</p>

    <div class="moves-list">
      <div
        v-for="move in availableMoves"
        :key="move.id"
        class="move-item"
        :class="{ 'move-item--locked': isLocked(move) }"
      >
        <div class="move-item__header" @click="expanded = expanded === move.id ? null : move.id">
          <div>
            <div class="move-item__name">{{ move.name }}</div>
            <div v-if="move.replacesId" class="move-item__replaces label">
              Заменяет: {{ fighter.moves.find(m => m.id === move.replacesId)?.name }}
            </div>
            <div v-if="isLocked(move)" class="move-item__locked-msg label">
              Требует: {{ fighter.moves.find(m => m.id === move.requiresId)?.name }}
            </div>
          </div>
          <span class="move-item__chevron">{{ expanded === move.id ? '▲' : '▼' }}</span>
        </div>
        <div v-if="expanded === move.id" class="move-item__desc">
          {{ move.description }}
        </div>
        <div v-if="!isLocked(move)" class="move-item__footer">
          <button class="btn-primary" @click="$emit('finish', move.id)">Выбрать этот ход</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-wrap { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; }
.step-title { font-size: 20px; font-weight: 700; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
.hint { font-size: 12px; color: var(--color-text-muted); }
.moves-list { display: flex; flex-direction: column; gap: 8px; }
.move-item { border: 1px solid var(--color-border); border-radius: var(--border-radius); overflow: hidden; }
.move-item--locked { opacity: 0.45; }
.move-item__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  cursor: pointer;
  background: var(--color-bg-elevated);
}
.move-item__name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.move-item__replaces { color: var(--color-text-muted); }
.move-item__locked-msg { color: var(--color-danger); }
.move-item__chevron { font-size: 10px; color: var(--color-text-muted); flex-shrink: 0; margin-left: 8px; }
.move-item__desc { padding: 0 12px 12px; font-size: 13px; color: var(--color-text-muted); line-height: 1.6; }
.move-item__footer { padding: 0 12px 12px; }
</style>
```

- [ ] **Step 4: Протестировать полный цикл Level Up**

1. Создай персонажа
2. Отметь XP кружки до порога (level + 7)
3. Нажми «Повысить уровень»
4. Выбери характеристику → выбери ход
5. Убедись что вернулся на `/character/:id` с обновлёнными данными

- [ ] **Step 5: Финальный прогон всех тестов**

```bash
npx vitest run
```

Ожидаемо: все тесты зелёные.

- [ ] **Step 6: Коммит**

```bash
git add src/features/level-up/
git commit -m "feat: implement level-up flow (stat + move selection)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Несколько персонажей в localStorage → characters store + persist
- ✅ `status: 'draft'` → видны в списке с пометкой
- ✅ Мастер создания 4 шага: Личность / Характеристики / Ходы / Снаряжение
- ✅ Игровой экран: шапка, HP/XP, статы с дебилити, sticky-табы
- ✅ `font-language-override: "BGR"` на Commissioner
- ✅ Кнопка Level Up при `xp >= level + 7`
- ✅ Level Up: 2 шага (стат + ход), `requiresId` блокирует, `replacesId` заменяет
- ✅ `load` вычисляется на лету из inventory, не хранится
- ✅ `startingMoveIds` копируются в `moveIds` при финализации
- ✅ Route guards на `/character/:id` и `/character/:id/levelup`

**Проверка типов:** все компоненты используют одни и те же интерфейсы из `src/types/character.ts`. `CharacterStatus`, `Stats`, `Debilities`, `Move`, `InventoryItem`, `Character` — определены однократно в Task 2.

**Плейсхолдеры:** отсутствуют.
