# Magic Tab Redesign

## Summary

Fix the magic tab visibility logic and add a description field to rituals.

## Changes

### 1. Data type — `Magic.rituals`

Change from `string[]` to `{ name: string; description: string }[]`.

Migration: in `ensureMagic()` (MagicPanel), normalise on read — if an element is a plain string, wrap it as `{ name: string, description: '' }`. No localStorage reset required.

### 2. Visibility logic — `InGameView`

`hasMagic` checks only `summoning | ritual` (remove `domination` and `incantations` as triggers).

`MagicPanel` receives a new prop `abilityIds: AbilityId[]`.

### 3. Section rendering — `MagicPanel`

| Section   | Condition                              |
|-----------|----------------------------------------|
| Духи      | `abilityIds.includes('summoning')`     |
| Ритуалы   | `abilityIds.includes('ritual')`        |
| Заклички  | `abilityIds.includes('incantations')`  |

### 4. Ritual card UI

Each ritual is a card (same style as spirits: bordered, `--color-bg-elevated`):
- `<input>` — name (single line), with `×` delete button on the right
- `<textarea>` — description (multiline, ~3 rows fixed height)

## Files to change

- `src/types/character.ts` — update `Magic.rituals` type
- `src/features/in-game/InGameView.vue` — update `hasMagic`, pass `abilityIds` to `MagicPanel`
- `src/features/in-game/components/MagicPanel.vue` — add prop, conditional sections, new ritual card UI, migration in `ensureMagic`
