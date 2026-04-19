# Stat Breakdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить попапы разбивки HP/урона/брони в ингейм-режиме и флаг «экипировано» на предметах инвентаря.

**Architecture:** Общий примитив `InfoPopover` (Reka UI Popover) оборачивается тремя специализированными компонентами (`HpBreakdownPopover`, `DamageBreakdownPopover`, `ArmorBreakdownPopover`). Вся логика разбивки — чистые функции в `derived.ts`. История HP-бросков хранится в новом поле `hpHistory` на персонаже.

**Tech Stack:** Vue 3 + TypeScript, Reka UI 2.x (`PopoverRoot/Trigger/Portal/Content`), Pinia persisted state.

---

## Карта файлов

| Файл | Действие |
|------|----------|
| `src/types/character.ts` | Изменить: +`hpHistory` в `Character`, +`equipped` в `InventoryItem` |
| `src/utils/derived.ts` | Изменить: +`BreakdownLine`, +`hpBreakdownLines`, +`damageBreakdownLines`, +`armorBreakdownLines` |
| `src/components/ui/InfoPopover.vue` | Создать: базовый Reka UI Popover |
| `src/components/ui/HpBreakdownPopover.vue` | Создать: попап разбивки HP |
| `src/components/ui/ArmorBreakdownPopover.vue` | Создать: попап разбивки брони |
| `src/components/ui/DamageBreakdownPopover.vue` | Создать: попап разбивки урона |
| `src/features/in-game/components/HeaderStrip.vue` | Изменить: добавить `HpBreakdownPopover` и `ArmorBreakdownPopover` |
| `src/features/in-game/components/CombatPanel.vue` | Изменить: добавить `DamageBreakdownPopover`, выделение экипированного |
| `src/features/in-game/components/InventoryPanel.vue` | Изменить: toggle экипировки, сортировка, варнинг |
| `src/features/character-creation/steps/StepGear.vue` | Изменить: записывать `hpHistory` при броске ОЗ |
| `src/features/level-up/LevelUpView.vue` | Изменить: обновлять `hpHistory` при левелапе |

---

## Task 1: Data model — типы

**Files:**
- Modify: `src/types/character.ts`

- [ ] **Step 1: Добавить `hpHistory` в `Character` и `equipped` в `InventoryItem`**

В `src/types/character.ts` найти `export interface InventoryItem` и добавить поле:

```ts
export interface InventoryItem {
  id: string
  name: string
  price?: number
  tags: string[]
  damage?: string
  notes?: string
  equipped?: boolean   // ← добавить
}
```

В `export interface Character` добавить поле после `maxHp`:

```ts
  hitDice: number
  currentHp: number
  maxHp: number
  hpHistory?: { level: number; roll: number; source: 'dice' | 'sturdy' }[]  // ← добавить
```

- [ ] **Step 2: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/types/character.ts
git commit -m "feat(types): add hpHistory to Character, equipped to InventoryItem"
```

---

## Task 2: Функции разбивки в `derived.ts`

**Files:**
- Modify: `src/utils/derived.ts`

- [ ] **Step 1: Добавить тип `BreakdownLine` и импорты**

В начало `src/utils/derived.ts` добавить в существующий импорт `InventoryItem`:

```ts
import type { AbilityId, ArmorState, Character, InventoryItem, StatKey } from '@/types/character'
```

(импорт уже существует, `InventoryItem` там уже есть — проверить, он может быть уже импортирован)

После импортов добавить тип:

```ts
export interface BreakdownLine {
  value: string
  label: string
}
```

- [ ] **Step 2: Добавить `hpBreakdownLines`**

В конец файла (после `sturdinessBonus`):

```ts
export function hpBreakdownLines(hpHistory: Character['hpHistory']): BreakdownLine[] {
  if (!hpHistory?.length) return []
  return hpHistory.map(entry => ({
    value: entry.source === 'sturdy' ? '+6' : String(entry.roll),
    label: entry.source === 'sturdy' ? 'Стойкость' : `ур. ${entry.level}, бросок к6`,
  }))
}
```

- [ ] **Step 3: Добавить `damageBreakdownLines`**

```ts
export function damageBreakdownLines(
  char: Pick<Character, 'abilityIds' | 'damageBonusDice'>,
  weapon: InventoryItem,
): BreakdownLine[] {
  if (!weapon.damage) return []
  const lines: BreakdownLine[] = [{ value: weapon.damage, label: 'оружие' }]
  const melee = weapon.tags.includes('weapon') && !weapon.tags.includes('ranged')
  const ranged = weapon.tags.includes('ranged')
  const abilityIds = char.abilityIds ?? []
  if (char.damageBonusDice > 0) lines.push({ value: `+${char.damageBonusDice}d6`, label: 'бонус уровня' })
  if (abilityIds.includes('skirmish')) lines.push({ value: '+1', label: 'Манёвренность' })
  if (melee && abilityIds.includes('hewing')) lines.push({ value: '+2', label: 'Рубка' })
  if (ranged && abilityIds.includes('volley')) lines.push({ value: '+2', label: 'Залп' })
  return lines
}
```

- [ ] **Step 4: Добавить `armorBreakdownLines`**

```ts
export function armorBreakdownLines(char: Pick<Character, 'armor' | 'abilityIds'>): {
  lines: BreakdownLine[]
  note?: string
} {
  const lines: BreakdownLine[] = []
  if (char.armor.type === 'full') lines.push({ value: '2', label: 'полный доспех' })
  else if (char.armor.type === 'light') lines.push({ value: '1', label: 'лёгкий доспех' })
  if (char.armor.shield) lines.push({ value: '+1', label: 'щит' })
  const abilityIds = char.abilityIds ?? []
  if (abilityIds.includes('toughness')) lines.push({ value: '+1', label: 'Прочность' })
  const note = abilityIds.includes('skirmish') ? 'доспех считается лёгким (Манёвренность)' : undefined
  return { lines, note }
}
```

- [ ] **Step 5: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/utils/derived.ts
git commit -m "feat(derived): add breakdown line functions for HP, damage, armor"
```

---

## Task 3: `InfoPopover` — базовый UI-примитив

**Files:**
- Create: `src/components/ui/InfoPopover.vue`

- [ ] **Step 1: Создать компонент**

Создать файл `src/components/ui/InfoPopover.vue`:

```vue
<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button class="info-btn" type="button" aria-label="Подробнее">ⓘ</button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="info-content" :side-offset="6" align="start">
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.info-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 0 3px;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
}
.info-btn:hover { color: var(--color-text); }
.info-content {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 10px 14px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 200;
  font-size: 13px;
}
</style>
```

- [ ] **Step 2: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/InfoPopover.vue
git commit -m "feat(ui): add InfoPopover base component using Reka UI"
```

---

## Task 4: `HpBreakdownPopover` + wire в `HeaderStrip`

**Files:**
- Create: `src/components/ui/HpBreakdownPopover.vue`
- Modify: `src/features/in-game/components/HeaderStrip.vue`

- [ ] **Step 1: Создать `HpBreakdownPopover.vue`**

Создать файл `src/components/ui/HpBreakdownPopover.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { hpBreakdownLines } from '@/utils/derived'
import InfoPopover from './InfoPopover.vue'

const props = defineProps<{ char: Character }>()

const lines = computed(() => hpBreakdownLines(props.char.hpHistory))
</script>

<template>
  <InfoPopover v-if="lines.length">
    <div class="bd">
      <div v-for="(line, i) in lines" :key="i" class="bd__row">
        <span class="bd__val">{{ line.value }}</span>
        <span class="bd__label">{{ line.label }}</span>
      </div>
      <div class="bd__divider" />
      <div class="bd__row bd__row--total">
        <span class="bd__val">{{ char.maxHp }}</span>
        <span class="bd__label">итого ОЗ</span>
      </div>
    </div>
  </InfoPopover>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 4px; }
.bd__row { display: flex; gap: 12px; align-items: baseline; }
.bd__val { font-family: monospace; font-weight: 600; min-width: 36px; text-align: right; }
.bd__label { color: var(--color-text-muted); }
.bd__divider { border-top: 1px solid var(--color-border); margin: 4px 0; }
.bd__row--total .bd__val { color: var(--color-accent); }
.bd__row--total .bd__label { color: var(--color-text); }
</style>
```

- [ ] **Step 2: Добавить попап в `HeaderStrip.vue`**

В `src/features/in-game/components/HeaderStrip.vue` добавить импорт в `<script setup>`:

```ts
import HpBreakdownPopover from '@/components/ui/HpBreakdownPopover.vue'
```

Найти блок HP-метра (строки 49–55 оригинала) и обновить его — добавить `HpBreakdownPopover` рядом со значением:

```html
<div class="meter">
  <div class="meter__label">HP</div>
  <div class="meter__controls">
    <button class="btn-mini" @click="bumpHp(-1)">−</button>
    <span class="meter__val">{{ char.currentHp }} / {{ char.maxHp }}</span>
    <HpBreakdownPopover :char="char" />
    <button class="btn-mini" @click="bumpHp(1)">+</button>
  </div>
</div>
```

- [ ] **Step 3: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/HpBreakdownPopover.vue src/features/in-game/components/HeaderStrip.vue
git commit -m "feat(in-game): add HP breakdown popover to header"
```

---

## Task 5: `ArmorBreakdownPopover` + wire в `HeaderStrip`

**Files:**
- Create: `src/components/ui/ArmorBreakdownPopover.vue`
- Modify: `src/features/in-game/components/HeaderStrip.vue`

- [ ] **Step 1: Создать `ArmorBreakdownPopover.vue`**

Создать файл `src/components/ui/ArmorBreakdownPopover.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { armorBreakdownLines, totalArmor } from '@/utils/derived'
import InfoPopover from './InfoPopover.vue'

const props = defineProps<{ char: Character }>()

const breakdown = computed(() => armorBreakdownLines(props.char))
const total = computed(() => totalArmor(props.char))
</script>

<template>
  <InfoPopover>
    <div class="bd">
      <div v-for="(line, i) in breakdown.lines" :key="i" class="bd__row">
        <span class="bd__val">{{ line.value }}</span>
        <span class="bd__label">{{ line.label }}</span>
      </div>
      <div v-if="!breakdown.lines.length" class="bd__row">
        <span class="bd__val">0</span>
        <span class="bd__label">без доспеха</span>
      </div>
      <div class="bd__divider" />
      <div class="bd__row bd__row--total">
        <span class="bd__val">{{ total }}</span>
        <span class="bd__label">итого броня</span>
      </div>
      <div v-if="breakdown.note" class="bd__note">* {{ breakdown.note }}</div>
    </div>
  </InfoPopover>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 4px; }
.bd__row { display: flex; gap: 12px; align-items: baseline; }
.bd__val { font-family: monospace; font-weight: 600; min-width: 36px; text-align: right; }
.bd__label { color: var(--color-text-muted); }
.bd__divider { border-top: 1px solid var(--color-border); margin: 4px 0; }
.bd__row--total .bd__val { color: var(--color-accent); }
.bd__row--total .bd__label { color: var(--color-text); }
.bd__note { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }
</style>
```

- [ ] **Step 2: Добавить попап в `HeaderStrip.vue`**

Добавить импорт в `<script setup>`:

```ts
import ArmorBreakdownPopover from '@/components/ui/ArmorBreakdownPopover.vue'
```

Найти блок брони (строки 37–40 оригинала) и обновить — добавить попап рядом с числом:

```html
<div class="hdr__armor">
  <div class="label">Броня</div>
  <div class="hdr__armor-row">
    <div class="hdr__armor-val">{{ armor }}</div>
    <ArmorBreakdownPopover :char="char" />
  </div>
</div>
```

Добавить стиль `.hdr__armor-row` в `<style scoped>`:

```css
.hdr__armor-row { display: flex; align-items: center; gap: 4px; }
```

- [ ] **Step 3: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ArmorBreakdownPopover.vue src/features/in-game/components/HeaderStrip.vue
git commit -m "feat(in-game): add armor breakdown popover to header"
```

---

## Task 6: `DamageBreakdownPopover` + wire в `CombatPanel`

**Files:**
- Create: `src/components/ui/DamageBreakdownPopover.vue`
- Modify: `src/features/in-game/components/CombatPanel.vue`

- [ ] **Step 1: Создать `DamageBreakdownPopover.vue`**

Создать файл `src/components/ui/DamageBreakdownPopover.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import { damageBreakdownLines, damageFormula } from '@/utils/derived'
import InfoPopover from './InfoPopover.vue'

const props = defineProps<{ char: Character; weapon: InventoryItem }>()

const lines = computed(() => damageBreakdownLines(props.char, props.weapon))
const total = computed(() => damageFormula(props.char, props.weapon))
</script>

<template>
  <InfoPopover v-if="lines.length">
    <div class="bd">
      <div v-for="(line, i) in lines" :key="i" class="bd__row">
        <span class="bd__val">{{ line.value }}</span>
        <span class="bd__label">{{ line.label }}</span>
      </div>
      <div class="bd__divider" />
      <div class="bd__row bd__row--total">
        <span class="bd__val">{{ total }}</span>
        <span class="bd__label">итого</span>
      </div>
    </div>
  </InfoPopover>
</template>

<style scoped>
.bd { display: flex; flex-direction: column; gap: 4px; }
.bd__row { display: flex; gap: 12px; align-items: baseline; }
.bd__val { font-family: monospace; font-weight: 600; min-width: 44px; text-align: right; }
.bd__label { color: var(--color-text-muted); }
.bd__divider { border-top: 1px solid var(--color-border); margin: 4px 0; }
.bd__row--total .bd__val { color: var(--color-accent); }
.bd__row--total .bd__label { color: var(--color-text); }
</style>
```

- [ ] **Step 2: Обновить `CombatPanel.vue`**

Полный заменённый `<script setup>`:

```ts
import { computed } from 'vue'
import type { Character } from '@/types/character'
import { damageFormula, totalArmor, armorLabel, isWeapon } from '@/utils/derived'
import DamageBreakdownPopover from '@/components/ui/DamageBreakdownPopover.vue'

const props = defineProps<{ char: Character }>()

const weapons = computed(() => props.char.inventory.filter(isWeapon))
const armor = computed(() => totalArmor(props.char))
```

Полный заменённый `<template>`:

```html
<template>
  <section class="panel">
    <div class="label">Бой</div>
    <div class="summary">
      <div>Броня: <b>{{ armor }}</b> ({{ armorLabel(char.armor) }})</div>
      <div v-if="char.damageBonusDice > 0">Бонус костей урона: <b>+{{ char.damageBonusDice }}d6</b></div>
    </div>
    <div v-if="weapons.length" class="weapons">
      <div
        v-for="w in weapons"
        :key="w.id"
        class="weapon"
        :class="{ 'weapon--equipped': w.equipped }"
      >
        <div class="weapon__name">{{ w.name }}</div>
        <div class="weapon__dmg-row">
          <span class="weapon__dmg">{{ damageFormula(char, w) }}</span>
          <DamageBreakdownPopover :char="char" :weapon="w" />
        </div>
      </div>
    </div>
    <div v-else class="empty">Нет оружия в инвентаре.</div>
  </section>
</template>
```

Полный заменённый `<style scoped>`:

```css
<style scoped>
.panel { padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
.summary { display: flex; gap: 16px; margin-top: 6px; font-size: 13px; color: var(--color-text-muted); }
.weapons { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.weapon { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 4px; }
.weapon--equipped { border-color: var(--color-accent); }
.weapon:not(.weapon--equipped) { opacity: 0.6; }
.weapon__name { font-weight: 600; }
.weapon__dmg-row { display: flex; align-items: center; gap: 4px; }
.weapon__dmg { font-family: monospace; }
.empty { margin-top: 6px; color: var(--color-text-muted); font-size: 13px; }
</style>
```

- [ ] **Step 3: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/DamageBreakdownPopover.vue src/features/in-game/components/CombatPanel.vue
git commit -m "feat(in-game): add damage breakdown popover and equipped weapon highlight"
```

---

## Task 7: Equipped toggle + сортировка + варнинг в `InventoryPanel`

**Files:**
- Modify: `src/features/in-game/components/InventoryPanel.vue`

- [ ] **Step 1: Добавить логику в `<script setup>`**

Добавить в `<script setup>` после функции `removeItem`:

```ts
function toggleEquipped(id: string) {
  emit('patch', {
    inventory: props.char.inventory.map(i =>
      i.id === id ? { ...i, equipped: !i.equipped } : i
    ),
  })
}

const sortedInventory = computed(() => {
  const equipped = props.char.inventory.filter(i => i.equipped)
  const rest = props.char.inventory.filter(i => !i.equipped)
  return [...equipped, ...rest]
})

const multipleWeaponsEquipped = computed(() =>
  props.char.inventory.filter(i => i.equipped && i.tags.includes('weapon')).length > 1
)
```

- [ ] **Step 2: Обновить `<template>` — блок инвентаря**

Найти блок `.list` (строки 93–107 оригинала) и заменить целиком:

```html
<div class="list">
  <div class="label">Инвентарь</div>
  <div v-if="multipleWeaponsEquipped" class="warn">⚠ Экипировано несколько видов оружия</div>
  <div v-for="item in sortedInventory" :key="item.id" class="inv-row" :class="{ 'inv-row--equipped': item.equipped }">
    <button
      class="equip-btn"
      :class="{ 'equip-btn--on': item.equipped }"
      type="button"
      :title="item.equipped ? 'Снять' : 'Экипировать'"
      @click="toggleEquipped(item.id)"
    >⚔</button>
    <div class="inv-row__info">
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
```

- [ ] **Step 3: Добавить стили**

Добавить в `<style scoped>` после `.inv-row`:

```css
.warn { font-size: 12px; color: var(--color-accent); padding: 6px 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-accent); border-radius: 3px; }
.inv-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; }
.inv-row--equipped { border-color: var(--color-accent); }
.inv-row__info { flex: 1; min-width: 0; }
.inv-row__name { font-weight: 600; }
.inv-row__notes { font-size: 11px; color: var(--color-text-muted); }
.inv-row__right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.equip-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 14px; padding: 0 2px; flex-shrink: 0; }
.equip-btn--on { color: var(--color-accent); }
```

Удалить старый стиль `.inv-row` если он дублируется.

- [ ] **Step 4: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/features/in-game/components/InventoryPanel.vue
git commit -m "feat(in-game): add equipped toggle, sorting, and multi-weapon warning to inventory"
```

---

## Task 8: Запись `hpHistory` при создании персонажа

**Files:**
- Modify: `src/features/character-creation/steps/StepGear.vue`

- [ ] **Step 1: Обновить `rollHp` в `StepGear.vue`**

Найти и заменить функцию `rollHp` (строки 12–16 оригинала):

```ts
function rollHp() {
  const numDice = hitDiceCount(props.draft.stats.con)
  const { total } = rollHitDice(numDice, props.draft.level)
  const sturdyBonus = sturdinessBonus(props.draft.abilityIds)
  const hp = total + sturdyBonus
  const hpHistory: NonNullable<Character['hpHistory']> = [
    { level: 1, roll: total, source: 'dice' },
    ...(sturdyBonus > 0 ? [{ level: 1, roll: 6, source: 'sturdy' as const }] : []),
  ]
  emit('patch', { hitDice: numDice, maxHp: hp, currentHp: hp, hpHistory })
}
```

Добавить импорт типа `Character` в `<script setup>` (если не импортирован):

```ts
import type { Character, InventoryItem, ArmorType } from '@/types/character'
```

(Проверить — в оригинале уже есть `import type { Character, InventoryItem, ArmorType }`)

- [ ] **Step 2: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/character-creation/steps/StepGear.vue
git commit -m "feat(creation): record hpHistory when rolling HP at character creation"
```

---

## Task 9: Обновление `hpHistory` при левелапе

**Files:**
- Modify: `src/features/level-up/LevelUpView.vue`

- [ ] **Step 1: Обновить `onHitDice` в `LevelUpView.vue`**

Найти и заменить функцию `onHitDice` (строки 57–66 оригинала):

```ts
function onHitDice(newMaxHp: number) {
  if (!char.value) return
  const oldMax = char.value.maxHp
  const hpGain = Math.max(0, newMaxHp - oldMax)
  pendingPatch.value.maxHp = newMaxHp
  pendingPatch.value.currentHp = (pendingPatch.value.currentHp ?? char.value.currentHp) + hpGain
  pendingPatch.value.hitDice = (pendingPatch.value.hitDice ?? char.value.hitDice) + 1
  const existing = pendingPatch.value.hpHistory ?? char.value.hpHistory ?? []
  pendingPatch.value.hpHistory = [...existing, { level: targetLevel.value, roll: hpGain, source: 'dice' as const }]
  done.value.hitDice = true
  advance()
}
```

- [ ] **Step 2: Обновить `onAbility` — добавить запись Стойкости**

Найти и заменить функцию `onAbility` (строки 76–87 оригинала):

```ts
function onAbility(aid: AbilityId) {
  if (!char.value) return
  const current = pendingPatch.value.abilityIds ?? char.value.abilityIds
  pendingPatch.value.abilityIds = [...current, aid]
  if (aid === 'sturdy') {
    const bonus = sturdinessBonus([aid])
    pendingPatch.value.maxHp = (pendingPatch.value.maxHp ?? char.value.maxHp) + bonus
    pendingPatch.value.currentHp = (pendingPatch.value.currentHp ?? char.value.currentHp) + bonus
    const existing = pendingPatch.value.hpHistory ?? char.value.hpHistory ?? []
    pendingPatch.value.hpHistory = [...existing, { level: targetLevel.value, roll: 6, source: 'sturdy' as const }]
  }
  done.value.ability = true
  advance()
}
```

- [ ] **Step 3: Проверить типы**

```bash
npm run build
```

Ожидание: компиляция без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/features/level-up/LevelUpView.vue
git commit -m "feat(level-up): record hpHistory entries on hit dice roll and sturdy ability"
```

---

## Финальная проверка

- [ ] Запустить `npm run dev`, открыть персонажа в ингейм-режиме
- [ ] Проверить: иконка `ⓘ` у HP открывает попап с разбивкой (только у персонажей с `hpHistory`)
- [ ] Проверить: иконка `ⓘ` у числа брони открывает попап
- [ ] Проверить: иконка `ⓘ` у каждого оружия открывает попап с разбивкой урона
- [ ] Проверить: в инвентаре кнопка ⚔ переключает экипировку; экипированные предметы поднимаются вверх
- [ ] Проверить: при экипировке >1 оружия появляется варнинг
- [ ] Проверить: создать нового персонажа → `hpHistory` записывается → попап HP работает
- [ ] Проверить: пройти левелап с хит-дайсом → попап HP показывает оба броска
