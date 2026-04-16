# Dungeon World Character Sheet — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Интерактивный листок персонажа для настольной RPG Dungeon World. Мобильное веб-приложение на Vue 3 + TypeScript с тёмным «пергаментным» визуальным стилем. Начинается с класса Fighter, архитектура рассчитана на добавление других классов без переделки.

---

## Решения и ограничения

| Параметр | Решение |
|---|---|
| Первый класс | Fighter (по ref-листу). Архитектура universal. |
| Персонажи | Несколько в одном браузере, список на главном экране |
| Данные игры | Хардкод в TypeScript-файлах (`src/data/classes/`) |
| Хранение | Pinia + localStorage (persist plugin) |
| UI-библиотека | Reka UI для сложных контролов |
| Визуальный стиль | Тёмный пергамент — золото (#d4a853) на тёмно-коричневом (#1a1208), рамки (#8b6914), засечный шрифт |
| Навигация режимов | Контекстная: основной экран — In-Game. Level-Up появляется по условию XP. |
| Компоновка игрового экрана | Гибрид: шапка + HP/XP + статы скроллятся, ниже sticky-табы (Ходы / Снаряжение / Связи) |

---

## Архитектура

### Структура папок

```
src/
├── data/
│   └── classes/
│       └── fighter.ts          # ходы, снаряжение, расы, облики, мировоззрения
├── features/
│   ├── character-list/         # экран выбора персонажа
│   ├── character-creation/     # 4-шаговый мастер
│   ├── in-game/                # основной игровой вид
│   └── level-up/               # экран повышения уровня
├── stores/
│   ├── characters.ts           # Pinia: список всех персонажей
│   └── active-character.ts     # Pinia: персонаж открытый сейчас
├── types/
│   └── character.ts            # все TypeScript-интерфейсы
├── components/ui/              # тонкие обёртки над Reka UI
└── router/
    └── index.ts
```

### Роутинг

| Путь | Компонент | Описание |
|---|---|---|
| `/` | `CharacterListView` | Список персонажей, кнопка «Создать» |
| `/character/new` | `CharacterCreationView` | 4-шаговый мастер |
| `/character/:id` | `InGameView` | Основной игровой экран |
| `/character/:id/levelup` | `LevelUpView` | Повышение уровня |

**Переходы:**
- После шага 4 мастера → `status: 'active'` → редирект на `/character/:id`
- Кнопка «Повысить уровень» в `InGameView` видна только при `xp >= level + 7`
- После завершения `LevelUpView` → редирект на `/character/:id`

---

## Модель данных (`src/types/character.ts`)

```typescript
type MoveType = 'starting' | 'advanced_2_5' | 'advanced_6_10'

interface Move {
  id: string
  classId: string        // 'fighter' | будущие классы
  name: string
  description: string
  type: MoveType
  requiresId?: string    // ход-условие (должен быть взят раньше)
  replacesId?: string    // этот ход заменяет указанный (upgrade)
}

interface Stats {
  str: number; dex: number; con: number
  int: number; wis: number; cha: number
}

interface Debilities {
  weak: boolean       // СИЛ -1
  shaky: boolean      // ЛОВ -1
  sick: boolean       // КОН -1
  stunned: boolean    // ИНТ -1
  confused: boolean   // МДР -1
  scarred: boolean    // ХАР -1
}

interface InventoryItem {
  id: string
  name: string
  weight: number
  tags: string[]
  uses?: number
}

type CharacterStatus = 'draft' | 'active'

interface Character {
  id: string
  createdAt: number
  status: CharacterStatus

  // Создание (используются при создании, не редактируются в игре)
  classId: string
  name: string
  look: string
  alignment: string
  race: string
  bonds: string[]
  startingMoveIds: string[]

  // Игровые
  stats: Stats
  currentHp: number
  maxHp: number
  armor: number
  xp: number
  level: number
  damageDice: string
  debilities: Debilities
  moveIds: string[]
  inventory: InventoryItem[]
  coins: number
  // load — вычисляется на лету как сумма weight всех inventory, не хранится
  maxLoad: number
}
```

### Данные класса (`src/data/classes/fighter.ts`)

```typescript
interface ClassData {
  id: string
  name: string
  damageDice: string
  baseHp: number         // Fighter: 10 + КОН-мод
  baseLoad: number       // Fighter: 12 + СИЛ-мод
  moves: Move[]
  startingGear: InventoryItem[][]   // группы на выбор
  alignments: string[]
  races: string[]
  looks: string[][]      // категории внешности (тело, глаза, волосы...)
}
```

---

## Экраны

### 1. Character List (`/`)

- Список карточек персонажей: имя, класс, уровень, HP-полоса
- Кнопка «+ Новый персонаж» → `/character/new`
- Нажатие на карточку → `/character/:id`
- `draft`-персонажи (незавершённое создание) показываются в списке с пометкой «не завершён» → нажатие ведёт на `/character/new` и восстанавливает прогресс

### 2. Character Creation (`/character/new`)

4 шага с прогресс-баром. Персонаж создаётся как `draft` и сохраняется в localStorage при каждом шаге. Навигация «Назад/Далее».

| # | Шаг | Контент |
|---|---|---|
| 1 | **Личность** | Имя (ввод), внешность (выбор из категорий), раса (с описанием расового хода), мировоззрение (с описанием триггера XP) |
| 2 | **Характеристики** | Распределение 6 готовых наборов чисел по 6 характеристикам |
| 3 | **Стартовые ходы** | Листаемый список ходов с описанием, выбрать нужное количество |
| 4 | **Снаряжение** | Выбор из наборов (оружие, броня, доп. предметы) |

После шага 4: вычисляются `maxHp`, `maxLoad`, `damageDice`; `startingMoveIds` копируются в `moveIds`; `status → 'active'`; редирект на `/character/:id`.

### 3. In-Game View (`/character/:id`)

**Структура (сверху вниз):**

1. **Шапка** — имя, класс, уровень, кость урона, броня. Скроллится.
2. **Хиты + XP** — HP с полосой и числами; XP в виде кружков (нажатие — отметить/снять). Скроллится.
3. **Характеристики** — сетка 3×2. Дебилити отображается inline в карточке стата: красная рамка, зачёркнутый модификатор, название состояния. Нажатие на стат — переключает дебилити. Скроллится.
4. **Sticky-табы** — `Ходы | Снаряжение | Связи`. Прилипают к верху при скролле.
5. **Контент таба:**
   - *Ходы* — аккордеон: первый раскрыт, остальные свёрнуты. Нажатие разворачивает описание.
   - *Снаряжение* — список предметов с весом. Счётчик нагрузки `X / maxLoad`. Кнопка добавить предмет.
   - *Связи* — редактируемые текстовые строки. Инициализируются пустыми шаблонами из класса Fighter (шаблоны вроде «_____ научил меня...»), которые игрок заполняет в процессе игры.

**Кнопка «Повысить уровень»** — появляется под шапкой только когда `xp >= level + 7` (правило Dungeon World). Ведёт на `/character/:id/levelup`.

### 4. Level Up (`/character/:id/levelup`)

2 шага:

**Шаг 1 — Характеристика.** Сетка 3×2. Каждая карточка показывает текущее значение и будущее (+1). Выбор одной характеристики. Если новое значение ≥ 16 → `maxHp` пересчитывается.

**Шаг 2 — Новый ход.** Список ходов нужного типа (`advanced_2_5` или `advanced_6_10`). Ходы с невыполненным `requiresId` показаны серыми и недоступны для выбора. Ходы с `replacesId` при выборе убирают старый ход из `moveIds`.

После подтверждения: `level += 1`, `xp = 0`, применяются изменения, редирект на `/character/:id`.

---

## Визуальный стиль

- **Палитра:** фон `#1a1208`, акцент `#d4a853`, рамки `#8b6914`, тревога/дебилити `#c0392b`
- **Шрифт:** Commissioner (Nikola Kostic, Сербия; Google Fonts) с болгарским locale для неокирилических форм:
  ```css
  font-family: 'Commissioner', sans-serif;
  font-feature-settings: "locl" 1;
  font-language-override: "BGR";
  ```
- **Рамки:** тонкие `1px solid`, прямые углы (border-radius 2px максимум)
- **Состояния:** активный стат с дебилити — красная рамка + зачёркнутый модификатор
- **Адаптив:** mobile-first, max-width ~480px для контента

---

## Что за рамками этой версии

- Аутентификация и синхронизация между устройствами
- Классы кроме Fighter
- GM-режим
- Экспорт/печать листа
