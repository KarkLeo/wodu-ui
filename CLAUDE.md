# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive character sheet for the tabletop RPG **World of Dungeons** (©1979 J.S. Harper with C. McDowell, One & Seven Tactical Design Institute, Seattle, WA). Mobile-first web app with three interface modes: character creation, in-game play (single character or shared party view), and level-up flow.

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # vue-tsc type check + Vite production build
npm run preview   # preview production build
npm run test      # vitest (watch mode); add --run for one-shot, --coverage for coverage
```

Run a single test file: `npm run test -- src/utils/derived.test.ts`.

## Tech Stack

- **Framework**: Vue 3 + TypeScript (strict), Vite
- **State / Persistence**: Pinia + `pinia-plugin-persistedstate`. localStorage keys: `wod.characters.v1`, `wod.creation.v1`, `wod.rollHistory.v1`, `wod.locale.v1`
- **UI Primitives**: [Reka UI](https://reka-ui.com/) (dropdowns, popovers, dialogs, tabs)
- **3D Dice**: `@3d-dice/dice-box` wrapped in `src/services/DiceBoxService.ts`
- **Routing**: Vue Router with route guards
- **Testing**: Vitest + happy-dom + `@vue/test-utils`. Coverage of **domain core only** — `src/utils/derived.ts` and `src/domain/reducer.ts`. Do not add tests for UI/stores/composables.

## Routes

| Route | View | Notes |
|-------|------|-------|
| `/` | `CharacterListView` | — |
| `/character/new` | `CharacterCreationView` | 3-step wizard |
| `/character/:id` | — | redirects to `/party/:id` |
| `/party/:ids` | `PartyView` | comma-separated ids; renders `InGameView` per character; guard filters out draft/missing ids |
| `/character/:id/levelup` | `LevelUpView` | guard redirects if not `active` |
| `/_preview` | `PrimitivesPreviewView` | dev-only sandbox for UI primitives |

## Data Model

Central type: `Character` (`src/types/character.ts`).

- `Stats` — six stats (`str/dex/con/int/wis/cha`), each stored as the **bonus** (not raw 2d6 roll)
- `StatModifier { id, statKey, amount, label }` — temporary buff/debuff stack on a stat
- `InventoryItem.descriptor: ItemDescriptor` — discriminated union: `weapon` (melee/ranged), `armor` (`class: 'none'|'light'|'full'`), `shield`, `gear`, `tool`, `occult`, `custom`. `equipped?: boolean` flags the active item.
- `Magic` — optional, only when class/abilities grant a magic section (cleric, wizard, etc.)
- `CharacterStatus` — `'draft'` (creation in progress) | `'active'` (fully created)
- `hpHistory: { level, roll, source: 'dice'|'sturdy' }[]` — every HP roll, per level

**Armor has no dedicated field.** `totalArmor` is computed from equipped inventory: `light` armor → 1, `full` → 2, `shield` → +1, plus `toughness` ability.

`ClassData` (`src/data/classes.ts`) drives starting skills/abilities per class.

## Domain Layer (`src/domain/`)

All gameplay state mutations go through commands. **Never** mutate `Character` from a component or composable.

- `commands.ts` — `CharacterCommand` discriminated union (~25 command types: inventory, combat, progression, stat modifiers, draft-only creation commands, misc)
- `reducer.ts` — `applyCommand(char, cmd): Character` — pure function, returns a new character
- `inventory.ts`, `combat.ts`, `progression.ts`, `creation.ts`, `modifiers.ts` — domain logic modules consumed by the reducer

Flow: composable → `store.dispatch(id, cmd)` → `applyCommand` → persisted state. The legacy `characters.update(id, patch)` exists only for the creation wizard's free-form edits; do not use it from gameplay.

## Derived Values (`src/utils/derived.ts`)

All computed/derived values live here — never recalculate inline in components.

- `totalArmor(char)` — equipped armor tags + `toughness`
- `damageAbilityBonus(char, weapon)`, `damageFormulaCompact(char, weapon)`, `damageFormulaParts(char, weapon)` — weapon damage with ability bonuses (`skirmish`, `hewing`, `volley`, etc.)
- `hpBreakdownLines(hpHistory)`, `damageBreakdownLines(char, weapon)`, `armorBreakdownLines(char)` — formatted rows for `InfoPopover`
- `isReadyToLevelUp(char)` — XP vs `XP_THRESHOLDS`
- `rollHitDice(numDice, level)` — rolls N d6, keeps top `level`
- `statBonusFrom2d6(roll)` — 2d6 → bonus (0/1/2/3)

`BreakdownLine { value, label }` is the shared interface for popover rows — `label` is a `LabelRef` (`{ key, params? }`), resolved with `tLabel()`, not a plain string.

Ability bonuses are **data-driven**: `src/data/abilities.ts` exposes `ABILITY_EFFECTS` and `getAbilityEffect(id)`. `derived.ts` reads this table — do not branch on ability IDs (`if (id === 'hewing')`) anywhere else.

Item use-effects similarly: `GearTemplate.useEffect` (`'quicksilver'` etc.) drives `domain/inventory.ts` — do not hardcode item IDs.

## Stores (`src/stores/`)

- `useCharactersStore` — persistent. State: `list`, `activeId`. Getters: `active`, `getById(id)`. Actions: `dispatch(id, cmd)`, `setActive`, `update` (legacy, creation only). Auto-records change-log entries on `dispatch` for active characters.
- `useCreationStore` — ephemeral wizard state: `draftId`, `step` (1–3)
- `useChangeLogStore` — recent gameplay changes (HP, XP, inventory) for the unified log
- `useRollHistoryStore` — persisted dice roll history (3D dice rolls + manual)

## Composables (`src/composables/`)

- `useActiveCharacter()` — reactive char + `dispatch` bound to route id
- `useInventory(dispatch)` — inventory command helpers
- `useLevelUp(char, dispatch)` — level-up state machine
- `useCharacterCreation()` — wizard flow + draft lifecycle
- `useDiceRoller()` — single source of truth for 3D dice rolls; coordinates with `DiceBoxService`. Holds the only "is rolling" lock — components should not roll directly.
- `useMercury(char, dispatch)` — quicksilver overdose UI flow (the gear use-effect)
- `useUnifiedLog()` — merged feed of change log + roll history for the in-game log panel

## Features (`src/features/`)

Feature-based folder structure:

- `character-list/` — `CharacterListView`
- `character-creation/` — `CharacterCreationView` + `steps/` (StepIdentity, StepTraining, StepGear)
- `in-game/` — `PartyView`, `InGameView`, `components/` (StatusHeader, StatsPanel, SkillsPanel, AbilitiesPanel, InventoryPanel + `inventory/` subcomponents, MagicPanel + `magic/` subcomponents, NotesPanel)
- `level-up/` — `LevelUpView` + `components/` (StepStat, StepHitDice, StepSkill, StepAbility, StepSummary)

## UI Primitives (`src/components/ui/`)

Thin wrappers around Reka UI for project-specific styling: `Button`, `BottomSheet`, `ConfirmSheet`, `InfoPopover`, `Stepper`, `TabBar`, `HpBar`, `XpBar`, `StatChip`, `SkillChip`, `StatusChip`, `StatusChipTrio`, `AbilityCard`, `FormCheckbox`, `SegmentedFilter`, plus `icons/`.

**`InfoPopover` rule:** `PopoverPortal` teleports content to `<body>`, bypassing Vue scoped CSS. Style `.info-content` in a non-scoped `<style>` block (currently lives in `src/assets/main.css`). Do not duplicate breakdown popovers — assemble breakdowns inline using `InfoPopover` + the `*BreakdownLines` helpers from `derived.ts`.

The in-game `StatusHeader` shows HP / XP / armor / equipped weapon damage with `InfoPopover` breakdowns. Armor and damage are read-only in the header — armor type is set by equipping items in the Inventory panel.

In-game tabs: **Основное** (stats/skills/abilities) → **Инвентарь** → optionally **Магия** → **Заметки**. There is no Combat tab.

## Localization (`src/locales/`)

- Trilingual (en/ru/uk), switchable at runtime. `src/locales/en.ts` is the **structural type authority** (`type Messages`); `ru.ts` and `uk.ts` are declared `const messages: Messages`, so `vue-tsc` fails the build on any key missing from (or extra in) any of the three. Add a new key to all three dictionaries together.
- Components use `t('key')` from `@/locales` for UI strings. Game vocabulary (skill/ability/class/stat/gear/cantrip/sphere-preset names) does **not** go through raw `t()` — reach it through the helpers in `src/locales/content.ts` (`skillName`, `abilityName`, `className`, `gearName`, `cantripName`, etc.), which resolve under `content.*` and are guarded at compile time by the `_guards` tuple in that file.
- Allowed inline: `console.*`, developer-only errors, technical strings (CSS classes, localStorage keys, event names).
- Existing hardcoded strings are migrated as files are touched — no mass migration.
- Key style: `section.subsection.name` in camelCase (e.g. `header.hpLabel`, `inventory.emptyState`). Group by screen/feature.

## Design References

- `ref/` — scans of the original character sheet; every field must be represented faithfully
- `mood/` — mood board defining the dark, handcrafted aesthetic
- `docs/architecture-review*.md` — historical architecture reviews (most recent reflects current state)

## Key Rules

- Creation-only fields are hidden once `status === 'active'`
- No decorative chrome — every UI element must serve a functional purpose
- All user data survives page refresh via Pinia persisted state
- Domain command dispatch is the only path for gameplay mutations
- Bump `version` in `package.json` (patch by default) whenever you change code — the in-app footer surfaces it via `__APP_VERSION__`, so a stale version means stale UI for users
