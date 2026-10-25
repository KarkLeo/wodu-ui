# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive character sheet for the tabletop RPG **World of Dungeons** (©1979 J.S. Harper with C. McDowell, One & Seven Tactical Design Institute, Seattle, WA). Mobile-first web app with three interface modes: character creation, in-game play (single character or shared party view), and level-up flow.

## Commands

```bash
npm run dev       # Nuxt dev server, http://localhost:3000
npm run build     # nuxi typecheck (vue-tsc, strict) + nuxt generate into .output/public
npm run preview   # serve the generated build
npm run test      # unit tests (vitest project `unit`, watch mode); add --run for one-shot, --coverage for coverage
npm run storybook        # Storybook dev server on :6006
npm run test-storybook   # runs every story and its play function in headless Chromium (vitest project `storybook`)
npm run build-storybook  # static Storybook into storybook-static/
```

Node 24 from `.nvmrc`, npm 11. Before the first `test-storybook`, install the browser: `npx playwright install chromium`. `postinstall` runs `nuxt prepare`, which generates `.nuxt/` (the root `tsconfig.json` references its tsconfigs).

Run a single test file: `npm run test -- app/utils/derived.test.ts`.

`npm run test-visual` compares every story against the local baseline in `.visual/baseline/` (gitignored). Never run `test-visual:update` unless the baseline is meant to change.

## Tech Stack

- **Framework**: Nuxt 4 in SPA mode (`ssr: false`, static `nuxt generate`), Vue 3 + TypeScript (strict). Application code lives in `app/`; `@/` points at `app/`
- **Auto-imports are off** (`imports.autoImport: false`, `components.dirs: []`). Every file imports what it uses explicitly, components included
- **Nuxt APIs** (`#app`, `#imports`, `#components`: `definePageMeta`, `defineNuxtRouteMiddleware`, `navigateTo`, `useRuntimeConfig`, `defineNuxtPlugin`, `NuxtPage`) are used only in `app/pages/`, `app/middleware/`, `app/plugins/` and `app/app.vue`. Components, composables and stores never import from them, so Storybook renders them without a Nuxt runtime; pass the value in as a prop or wrap it instead. They keep using `useRoute`/`useRouter` from `vue-router`
- **Startup**: `app/plugins/02.bootstrap.client.ts` points PocketBase at `runtimeConfig.public.pbUrl` (from `VITE_PB_URL` at build time) and awaits `bootstrap()` before the first navigation and render
- **State / Persistence**: Pinia + `pinia-plugin-persistedstate`. localStorage keys: `wod.characters.v1`, `wod.creation.v1`, `wod.rollHistory.v1`, `wod.locale.v1`
- **UI Primitives**: [Reka UI](https://reka-ui.com/) (dropdowns, popovers, dialogs, tabs)
- **3D Dice**: `@3d-dice/dice-box-threejs` wrapped in `app/services/DiceAnimationQueue.ts`
- **Routing**: Nuxt file-based pages in `app/pages/` (vue-router underneath); guards are named route middleware in `app/middleware/` over pure functions in `app/utils/routeGuards.ts`
- **Testing**: Vitest + happy-dom + `@vue/test-utils`. Coverage of **domain core only** — `app/utils/derived.ts`, `app/domain/reducer.ts` and the route guards in `app/utils/routeGuards.ts`. Do not add unit tests for UI/stores/composables — UI behaviour is covered by Storybook stories with `play` functions, which CI runs.

## Routes

Route names are set with `definePageMeta({ name })` and used by `router.push({ name })` and `app/stories/router.ts`; keep them stable.

| Route | Name | Page file | View | Notes |
|-------|------|-----------|------|-------|
| `/` | `character-list` | `pages/index.vue` | `CharacterListView` | — |
| `/character/new` | `character-new` | `pages/character/new.vue` | `CharacterCreationView` | 3-step wizard |
| `/character/:id` | `in-game` | `pages/character/[id]/index.vue` | — | redirects to `/party/:id` |
| `/party/:ids` | `party` | `pages/party/[ids].vue` | `PartyView` | comma-separated ids; renders `InGameView` per character; `party` middleware filters out draft/missing ids |
| `/character/:id/levelup` | `level-up` | `pages/character/[id]/levelup.vue` | `LevelUpView` | `level-up` middleware redirects if not `active` |
| anything else | `slug` | `pages/[...slug].vue` | — | renders nothing, so the layout stays (the old router had no catch-all) |

## Data Model

Central type: `Character` (`app/types/character.ts`).

- `Stats` — six stats (`str/dex/con/int/wis/cha`), each stored as the **bonus** (not raw 2d6 roll)
- `StatModifier { id, statKey, amount, label }` — temporary buff/debuff stack on a stat
- `InventoryItem.descriptor: ItemDescriptor` — discriminated union: `weapon` (melee/ranged), `armor` (`class: 'none'|'light'|'full'`), `shield`, `gear`, `tool`, `occult`, `custom`. `equipped?: boolean` flags the active item.
- `Magic` — optional, only when class/abilities grant a magic section (cleric, wizard, etc.)
- `CharacterStatus` — `'draft'` (creation in progress) | `'active'` (fully created)
- `hpHistory: { level, roll, source: 'dice'|'sturdy' }[]` — every HP roll, per level

**Armor has no dedicated field.** `totalArmor` is computed from equipped inventory: `light` armor → 1, `full` → 2, `shield` → +1, plus `toughness` ability.

`ClassData` (`app/data/classes.ts`) drives starting skills/abilities per class.

## Domain Layer (`app/domain/`)

All gameplay state mutations go through commands. **Never** mutate `Character` from a component or composable.

- `commands.ts` — `CharacterCommand` discriminated union (~25 command types: inventory, combat, progression, stat modifiers, draft-only creation commands, misc)
- `reducer.ts` — `applyCommand(char, cmd): Character` — pure function, returns a new character
- `inventory.ts`, `combat.ts`, `progression.ts`, `creation.ts`, `modifiers.ts` — domain logic modules consumed by the reducer

Flow: composable → `store.dispatch(id, cmd)` → `applyCommand` → persisted state. The legacy `characters.update(id, patch)` exists only for the creation wizard's free-form edits; do not use it from gameplay.

## Derived Values (`app/utils/derived.ts`)

All computed/derived values live here — never recalculate inline in components.

- `totalArmor(char)` — equipped armor tags + `toughness`
- `damageAbilityBonus(char, weapon)`, `damageFormulaCompact(char, weapon)`, `damageFormulaParts(char, weapon)` — weapon damage with ability bonuses (`skirmish`, `hewing`, `volley`, etc.)
- `hpBreakdownLines(hpHistory)`, `damageBreakdownLines(char, weapon)`, `armorBreakdownLines(char)` — formatted rows for `InfoPopover`
- `isReadyToLevelUp(char)` — XP vs `XP_THRESHOLDS`
- `rollHitDice(numDice, level)` — rolls N d6, keeps top `level`
- `statBonusFrom2d6(roll)` — 2d6 → bonus (0/1/2/3)

`BreakdownLine { value, label }` is the shared interface for popover rows — `label` is a `LabelRef` (`{ key, params? }`), resolved with `tLabel()`, not a plain string.

Ability bonuses are **data-driven**: `app/data/abilities.ts` exposes `ABILITY_EFFECTS` and `getAbilityEffect(id)`. `derived.ts` reads this table — do not branch on ability IDs (`if (id === 'hewing')`) anywhere else.

Item use-effects similarly: `GearTemplate.useEffect` (`'quicksilver'` etc.) drives `domain/inventory.ts` — do not hardcode item IDs.

## Stores (`app/stores/`)

- `useCharactersStore` — persistent. State: `list`, `activeId`. Getters: `active`, `getById(id)`. Actions: `dispatch(id, cmd)`, `setActive`, `update` (legacy, creation only). Auto-records change-log entries on `dispatch` for active characters.
- `useCreationStore` — ephemeral wizard state: `draftId`, `step` (1–3)
- `useChangeLogStore` — recent gameplay changes (HP, XP, inventory) for the unified log
- `useRollHistoryStore` — persisted dice roll history (3D dice rolls + manual)

## Composables (`app/composables/`)

- `useActiveCharacter()` — reactive char + `dispatch` bound to route id
- `useInventory(dispatch)` — inventory command helpers
- `useLevelUp(char, dispatch)` — level-up state machine
- `useCharacterCreation()` — wizard flow + draft lifecycle
- `useDiceRoller()` — single source of truth for 3D dice rolls; coordinates with `DiceBoxService`. Holds the only "is rolling" lock — components should not roll directly.
- `useMercury(char, dispatch)` — quicksilver overdose UI flow (the gear use-effect)
- `useUnifiedLog()` — merged feed of change log + roll history for the in-game log panel

## Features (`app/features/`)

Feature-based folder structure:

- `character-list/` — `CharacterListView`
- `character-creation/` — `CharacterCreationView` + `steps/` (StepIdentity, StepTraining, StepGear)
- `in-game/` — `PartyView`, `InGameView`, `components/` (StatusHeader, StatsPanel, SkillsPanel, AbilitiesPanel, InventoryPanel + `inventory/` subcomponents, MagicPanel + `magic/` subcomponents, NotesPanel)
- `level-up/` — `LevelUpView` + `components/` (StepStat, StepHitDice, StepSkill, StepAbility, StepSummary)

## UI Primitives (`app/components/ui/`)

Thin wrappers around Reka UI for project-specific styling: `Button`, `BottomSheet`, `ConfirmSheet`, `InfoPopover`, `Stepper`, `TabBar`, `HpBar`, `XpBar`, `StatChip`, `SkillChip`, `StatusChip`, `StatusChipTrio`, `AbilityCard`, `FormCheckbox`, `SegmentedFilter`, plus `icons/`.

**`InfoPopover` rule:** `PopoverPortal` teleports content to `<body>`, bypassing Vue scoped CSS. Style `.info-content` in a non-scoped `<style>` block (currently lives in `app/assets/main.css`). Do not duplicate breakdown popovers — assemble breakdowns inline using `InfoPopover` + the `*BreakdownLines` helpers from `derived.ts`.

The in-game `StatusHeader` shows HP / XP / armor / equipped weapon damage with `InfoPopover` breakdowns. Armor and damage are read-only in the header — armor type is set by equipping items in the Inventory panel.

In-game tabs (`inGame.tabs.*`): **Main** (stats/skills/abilities) → **Inventory** → optionally **Magic** → **Notes**. There is no Combat tab.

## Localization (`app/locales/`)

- Trilingual (en/ru/uk), switchable at runtime. `app/locales/en.ts` is the **structural type authority** (`type Messages`); `ru.ts` and `uk.ts` are declared `const messages: Messages`, so `vue-tsc` fails the build on any key missing from (or extra in) any of the three. Add a new key to all three dictionaries together.
- Components use `t('key')` from `@/locales` for UI strings. Game vocabulary (skill/ability/class/stat/gear/cantrip/sphere-preset names) does **not** go through raw `t()` — reach it through the helpers in `app/locales/content.ts` (`skillName`, `abilityName`, `className`, `gearName`, `cantripName`, etc.), which resolve under `content.*` and are guarded at compile time by the `_guards` tuple in that file.
- Allowed inline: `console.*`, developer-only errors, technical strings (CSS classes, localStorage keys, event names).
- Existing hardcoded strings are migrated as files are touched — no mass migration.
- Key style: `section.subsection.name` in camelCase (e.g. `header.hpLabel`, `inventory.emptyState`). Group by screen/feature.

## Design References

Reference materials live outside this repo, in the workspace folder next to it (paths below are relative to this repo's root):

- `../materials/design-vtt/app-doc/world_of_dungeons_1979_bw.pdf` (+ `.md` / `_ru.md` transcriptions) — the original rulebook and character sheet; every field must be represented faithfully
- `../materials/design-vtt/design/` — `palette.html` (design tokens, source of visual truth) and per-component HTML prototypes defining the dark, handcrafted aesthetic
- `../materials/design-vtt/app-doc/rules/`, `../materials/design-vtt/app-doc/specs/` — game rules and the behavioural specs derived from them
- `../materials/notes/architecture-review*.md` — historical architecture reviews (most recent reflects current state)

## Key Rules

- Creation-only fields are hidden once `status === 'active'`
- No decorative chrome — every UI element must serve a functional purpose
- All user data survives page refresh via Pinia persisted state
- Domain command dispatch is the only path for gameplay mutations
- Bump `version` in `package.json` (patch by default) whenever you change code — the in-app footer surfaces it via `__APP_VERSION__`, so a stale version means stale UI for users
