# Magic System Spec

## Overview

Magic is available to any character who has at least one magic-related ability: **Ritual**, **Summoning**, **Domination**, or **Incantations**. Wizard class gets magic enabled automatically.

When a character has magic, the **Magic tab** appears in the in-game view alongside Основное, Инвентарь, and Заметки.

---

## Ability Unlock Rules

| Ability ID     | Grants                                        |
|----------------|-----------------------------------------------|
| `summoning`    | Access to Spirit CRUD; initializes `magic`    |
| `domination`   | Domination over spirits (flavor/rules text)   |
| `ritual`       | Access to Ritual CRUD; 2 starter ritual slots |
| `incantations` | Fixed cantrips: Свеча, Тень, Чревовещание     |

- **Wizard class** (`classId === 'wizard'`): magic is initialized at creation with 2 empty spirit slots regardless of ability picks.
- If a character unpicks all magic abilities (during creation), the `magic` field is cleared (`undefined`).
- On level-up, gaining `summoning` initializes `magic: { spirits: [], rituals: [], cantrips: [] }` if not already present.

---

## Data Model

```ts
interface Spirit {
  id: string        // crypto.randomUUID()
  name: string
  appearance: string
  sphere1: string   // primary magic sphere
  sphere2: string   // secondary magic sphere
}

interface Ritual {
  name: string
  description: string
}

interface Magic {
  spirits: Spirit[]
  rituals: Ritual[]
  cantrips: string[]  // fixed names; e.g. ['Свеча', 'Тень', 'Чревовещание']
}
```

Character fields:
- `magic?: Magic` — only present if the character has at least one magic ability
- `quicksilverCount?: number` — cumulative mercury doses consumed today (default 0)

---

## Magic Panel UI (in-game)

Three sections:

### 1. Spirits (CRUD)
- Shown when character has `summoning` or is a Wizard.
- Each spirit: editable fields for **Name**, **Appearance**, **Sphere 1**, **Sphere 2**.
- Sphere inputs offer preset suggestions from `SPHERE_PRESETS`: Огонь, Тень, Камень, Молния, Тайны, Страх.
- **Add** button creates a new empty spirit slot via `UPDATE_MAGIC`.
- **Delete** button (×) removes spirit by `id`.

### 2. Rituals (CRUD)
- Shown when character has `ritual` ability.
- Each ritual: editable **Name** and **Description** (textarea).
- **Add** button creates a new empty ritual entry.
- **Delete** button (×) removes ritual by index.
- At creation, 2 empty ritual slots are pre-populated.

### 3. Cantrips
- Shown when character has `incantations` ability.
- Fixed list: **Свеча**, **Тень**, **Чревовещание** — display only, not editable.

---

## Mercury (Quicksilver) Mechanics

### Item
- Name: `Ртуть (доза)` · `templateId: 'mercury'` · Price: 10 coins · Descriptor: `occult`, consumable.
- Notes: "Слабый яд и наркотик. Больше доз в день, чем уровень — бросок ТЕЛ против эффектов."

### Counter
- Displayed in the Magic panel: **"Ртуть: X / Y"** where X = `quicksilverCount`, Y = `character.level`.
- This represents doses consumed today / daily safe limit.
- Counter turns red and shows a warning when overdose is reached.

### Daily Limit
- Safe doses per day = **character level**.
- `isQuicksilverOverdose(char)` returns `true` when `quicksilverCount >= level`.

### Drinking Mercury
Mercury can be consumed from two places:
1. **Inventory panel** — "use" action on a mercury item.
2. **Magic panel** — dedicated drink button.

Both paths call `useItem()` in `src/domain/inventory.ts`, which increments `quicksilverCount` by 1 and removes one dose from inventory.

### Overdose Dialog
When the character attempts to drink mercury at or beyond the daily limit, an overdose dialog appears with three options:

| Button         | Action                                                                          |
|----------------|---------------------------------------------------------------------------------|
| Cancel         | Close dialog, do not drink                                                      |
| Reset counter  | Dispatch `RESET_QUICKSILVER` (sets `quicksilverCount = 0`); treat as new day   |
| Roll CON       | Drinks mercury (increments counter); CON roll resolves at table (no app effect) |

### New Day Reset
- "Новый день" button in Magic panel dispatches `RESET_QUICKSILVER`.
- Command: `{ type: 'RESET_QUICKSILVER' }` → reducer calls `resetQuicksilver(char)` → sets `quicksilverCount = 0`.

---

## Domain Commands

```ts
{ type: 'UPDATE_MAGIC'; magic: Magic }  // full replace of magic object
{ type: 'RESET_QUICKSILVER' }           // reset daily mercury counter
```

All CRUD operations (add/update/delete spirit or ritual) dispatch `UPDATE_MAGIC` with the full updated `Magic` object.

---

## Key Files

| Purpose               | File                                                              |
|-----------------------|-------------------------------------------------------------------|
| Types                 | `src/types/character.ts`                                          |
| Sphere presets        | `src/data/spheres.ts`                                             |
| Mercury item          | `src/data/gear.ts`                                                |
| Domain commands       | `src/domain/commands.ts`                                          |
| Reducer               | `src/domain/reducer.ts`                                           |
| Mercury domain logic  | `src/domain/inventory.ts`                                         |
| Overdose check        | `src/utils/derived.ts` — `isQuicksilverOverdose()`               |
| Magic panel UI        | `src/features/in-game/components/MagicPanel.vue`                 |
| Inventory (mercury)   | `src/features/in-game/components/InventoryPanel.vue`             |
| Creation magic setup  | `src/features/character-creation/steps/StepTraining.vue`         |
| Level-up magic init   | `src/composables/useLevelUp.ts`                                   |
