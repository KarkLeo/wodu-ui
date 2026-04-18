# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive character sheet for the tabletop RPG **World of Dungeons** (©1979 J.S. Harper with C. McDowell, One & Seven Tactical Design Institute, Seattle, WA). Mobile-first web app with three interface modes: character creation, in-game play, and level-up flow.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # vue-tsc type check + Vite production build
npm run preview   # preview production build
```

There are no tests in this project — do not add or maintain them.

## Tech Stack

- **Framework**: Vue 3 + TypeScript
- **State / Persistence**: Pinia + `pinia-plugin-persistedstate`; localStorage keys are `wod.characters.v1` and `wod.creation.v1`
- **UI Components**: [Reka UI](https://reka-ui.com/) for complex controls (dropdowns, dialogs, tabs, etc.)
- **Routing**: Vue Router with route guards that redirect draft/missing characters to `/`

## Data Model

The central type is `Character` (`src/types/character.ts`). Key sub-types:
- `Stats` — six stats (`str/dex/con/int/wis/cha`), each stored as a bonus (not raw roll)
- `ArmorState` — `type: 'none'|'light'|'full'` + `shield: boolean`
- `InventoryItem` — tagged items; `tags: ['weapon']` marks weapons, `'ranged'` marks ranged weapons
- `Magic` — optional, only present for wizard/cleric classes
- `CharacterStatus` — `'draft'` (creation in progress) | `'active'` (fully created)

`ClassData` is defined in `src/data/classes.ts` and drives what skills/abilities each class grants.

## Computed Logic (`src/utils/derived.ts`)

All derived values live here — never recalculate inline in components:
- `totalArmor` — base armor + shield + `toughness` ability bonus
- `damageFormula` — weapon damage string with ability bonuses (`skirmish`, `hewing`, `volley`)
- `isReadyToLevelUp` — compares `xp` against `XP_THRESHOLDS` table
- `rollHitDice(numDice, level)` — rolls N d6, keeps top `level`, returns rolls/kept/total
- `statBonusFrom2d6(roll)` — converts 2d6 roll to stat bonus (0/1/2/3)

## Stores

- `useCharactersStore` (`src/stores/characters.ts`) — the only persistent store for characters; `active` getter returns the currently selected character
- `useCreationStore` (`src/stores/creation.ts`) — ephemeral creation wizard state; tracks `draftId` and `step` (1–3)

## Routes & Views

| Route | View | Guard |
|-------|------|-------|
| `/` | `CharacterListView` | — |
| `/character/new` | `CharacterCreationView` | — |
| `/character/:id` | `InGameView` | redirects if draft/missing |
| `/character/:id/levelup` | `LevelUpView` | redirects if not active |

## Architecture Guidelines

- Feature-based folder structure: `src/features/{character-creation,in-game,level-up}/`
- All domain constants (skills list, abilities list, gear catalog, XP table, magic spheres) live in `src/data/`
- Keep Reka UI primitives wrapped in thin project-specific components under `src/components/ui/`

## Design References

- `ref/` — reference scans of the original character sheet; every field must be represented faithfully
- `mood/` — mood board defining the dark, handcrafted visual aesthetic

## Key UX Rules

- Creation-only fields are hidden once `status === 'active'`
- No decorative UI chrome — every element must serve a functional purpose
- All user data survives page refresh via Pinia persisted state
