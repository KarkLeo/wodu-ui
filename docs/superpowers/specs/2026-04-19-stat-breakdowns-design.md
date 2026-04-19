# Дизайн: разбивки HP, урона и брони + экипированное оружие

**Дата:** 2026-04-19  
**Статус:** одобрен

## Обзор

Три информационных попапа в ингейм-режиме показывают из чего складываются ключевые боевые показатели: HP, урон, броня. Плюс статус «экипировано» для оружий в инвентаре.

---

## 1. Изменения модели данных

### 1.1 История HP-бросков (`hpHistory`)

Новое поле в `Character` (`src/types/character.ts`):

```ts
hpHistory?: { level: number; roll: number; source: 'dice' | 'sturdy' }[]
```

- `source: 'dice'` — бросок hit die на данном уровне
- `source: 'sturdy'` — бонус +6 от абилки Стойкость
- Поле опциональное; у существующих персонажей будет `undefined`

**Где заполняется:**
- `StepGear.vue` (создание, ур. 1): записывает запись `{ level: 1, roll: total, source: 'dice' }`
- `LevelUpView.vue` (левелап): записывает `{ level: targetLevel, roll: gain, source: 'dice' }` и отдельно `{ level: targetLevel, roll: 6, source: 'sturdy' }` при выборе Стойкости

**Поведение для старых персонажей:** иконка `ⓘ` рядом с HP не отображается, если `hpHistory` отсутствует.

### 1.2 Экипированное оружие (`equipped`)

Новое опциональное поле в `InventoryItem`:

```ts
equipped?: boolean
```

- По умолчанию `undefined` / `false`
- Нет жёсткого ограничения на количество экипированных оружий
- Только предметы с тегом `weapon` получают этот флаг

---

## 2. Общий UI-примитив

### `<InfoPopover>` (`src/components/ui/InfoPopover.vue`)

Тонкая обёртка над Reka UI Popover. Принимает:
- Слот `#trigger` — иконка `ⓘ` (кнопка без chrome)
- Слот по умолчанию — контент разбивки

Стиль: тёмный фон, моноширинный шрифт для числовых колонок, в духе существующего дизайна проекта (переменные `--color-bg-elevated`, `--color-border`).

---

## 3. Три компонента разбивки

### 3.1 `<HpBreakdownPopover>` 

**Расположение:** рядом с `{{ char.currentHp }} / {{ char.maxHp }}` в `HeaderStrip.vue`  
**Условие показа:** только если `char.hpHistory` существует и непуст

**Контент попапа:**
```
● 4   (ур. 1, бросок к6)
● 3   (ур. 2, бросок к6)
● +6  (Стойкость)
─────────────────
  13  итого
```

Строки генерируются из `hpHistory`: для `source: 'dice'` — `(ур. N, бросок к6)`, для `source: 'sturdy'` — `(Стойкость)`.

### 3.2 `<DamageBreakdownPopover>`

**Расположение:** рядом с формулой урона каждого оружия в `CombatPanel.vue`  
**Показывается:** у всех оружий, независимо от статуса экипировки

**Контент попапа** (пример: меч, Манёвренность + Рубка):
```
● 1d6        (оружие)
● +1         (Манёвренность)
● +2         (Рубка)
─────────────────
  1d6 +3
```

Логика строк:
- Всегда: `weapon.damage` → `(оружие)`
- `char.damageBonusDice > 0` → `+Nd6  (бонус уровня)`
- `skirmish` в abilityIds → `+1  (Манёвренность)`
- `hewing` + ближнее оружие → `+2  (Рубка)`
- `volley` + дальнее оружие → `+2  (Залп)`

### 3.3 `<ArmorBreakdownPopover>`

**Расположение:** рядом с числом брони в `HeaderStrip.vue`

**Контент попапа** (пример: полный доспех + щит + Прочность):
```
● 2          (полный доспех)
● +1         (щит)
● +1         (Прочность)
─────────────────
  4  итого
```

Строки:
- `armor.type === 'full'` → `2  (полный доспех)`
- `armor.type === 'light'` → `1  (лёгкий доспех)`
- `armor.type === 'none'` — строка не добавляется (итог 0)
- `armor.shield` → `+1  (щит)`
- `toughness` в abilityIds → `+1  (Прочность)`
- `skirmish` в abilityIds → примечание под чертой: `* доспех считается лёгким (Манёвренность)`

---

## 4. Экипированные предметы в InventoryPanel

**Переключатель:** у **каждого** предмета в `InventoryPanel.vue` — иконка-кнопка для toggle `item.equipped`. Игрок сам решает что считать экипированным (одежда, украшения, амулеты, оружие и т.д.).

**Сортировка:** экипированные предметы всегда отображаются вверху списка, неэкипированные — ниже. Внутри каждой группы порядок сохраняется.

**Варнинг:** только если экипировано >1 предмета с тегом `weapon` — статичный блок вверху `InventoryPanel`:
```
⚠ Экипировано несколько видов оружия
```

**В CombatPanel:** экипированные оружия визуально выделены (например, акцентная рамка), неэкипированные отображаются приглушённее.

---

## 5. Файлы затронутые изменениями

| Файл | Изменение |
|------|-----------|
| `src/types/character.ts` | +`hpHistory` в `Character`, +`equipped` в `InventoryItem` |
| `src/utils/derived.ts` | новые функции `hpBreakdownLines()`, `damageBreakdownLines()`, `armorBreakdownLines()` |
| `src/components/ui/InfoPopover.vue` | новый компонент |
| `src/components/ui/HpBreakdownPopover.vue` | новый компонент |
| `src/components/ui/DamageBreakdownPopover.vue` | новый компонент |
| `src/components/ui/ArmorBreakdownPopover.vue` | новый компонент |
| `src/features/in-game/components/HeaderStrip.vue` | +`HpBreakdownPopover`, +`ArmorBreakdownPopover` |
| `src/features/in-game/components/CombatPanel.vue` | +`DamageBreakdownPopover`, визуальное выделение экипированного |
| `src/features/in-game/components/InventoryPanel.vue` | +toggle экипировки, +варнинг |
| `src/features/character-creation/steps/StepGear.vue` | записывать `hpHistory` при создании |
| `src/features/level-up/LevelUpView.vue` | обновлять `hpHistory` при левелапе |
