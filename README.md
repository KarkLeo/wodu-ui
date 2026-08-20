# World of Dungeons — Character Sheet

[![CI](https://github.com/KarkLeo/wodu-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/KarkLeo/wodu-ui/actions/workflows/ci.yml)

An interactive character sheet and lightweight VTT for the tabletop RPG **World of Dungeons**. Mobile-first PWA: roll 3D dice, track HP/XP and inventory, level up, and share a live party view with the table.

**Live demo → [wod.karkleo.com](https://wod.karkleo.com/)**

> The demo runs against a public prototype backend with no authentication — anything you create there is visible and editable by anyone. Do not put real data in it.

## Screenshots

<!-- Drop images into screenshots/ and they will render here. -->
| Character creation | In game | Level up |
|---|---|---|
| ![Creation](screenshots/creation.png) | ![In game](screenshots/in-game.png) | ![Level up](screenshots/level-up.png) |

## Stack

Vue 3 + TypeScript (strict) · Vite · Pinia (persisted) · Vue Router · Reka UI · vite-plugin-pwa · Vitest · PocketBase as the sync backend.

## Running locally

```bash
npm install
cp .env.example .env      # VITE_PB_URL — where the PocketBase instance lives
npm run dev               # http://localhost:5173
```

Other scripts:

```bash
npm run build             # vue-tsc (strict) + production build
npm run preview
npm run test              # vitest, watch mode
npm run test -- --run     # one-shot
```

The app needs a reachable PocketBase instance to boot — see [wodu-api](https://github.com/KarkLeo/wodu-api) for the backend (stock PocketBase plus migrations, no server-side logic).

## Architecture

The interesting part is that **all game logic is client-side and pure**. The backend is a dumb JSON store with realtime fan-out; it never parses or validates the domain.

```
src/
  domain/      pure reducer + command types — the entire rules engine
  utils/       derived values (armor, damage formulas, HP breakdowns)
  data/        static game data: classes, abilities, gear, spheres
  stores/      Pinia — persistence and dispatch
  composables/ reactive glue between UI and domain
  features/    screens: character-list, character-creation, in-game, level-up
  components/  UI primitives on top of Reka UI
  locales/     en / ru / uk dictionaries
  transport/   PocketBase client, bootstrap, realtime subscription
```

Every gameplay mutation goes through one path:

```
UI → composable → store.dispatch(id, command)
                → applyCommand(character, command)   // pure, src/domain/reducer.ts
                → new Character                      // optimistic local + push to backend
```

Nothing outside `src/domain/` mutates a character. That keeps the rules engine testable in isolation, which is where the test suite lives — `domain/` and `utils/derived.ts` are covered, UI is not. Ability and item effects are data-driven tables (`src/data/abilities.ts`, `src/data/gear.ts`), so adding a new ability is a data change, not a new branch in the derivation code.

Trade-offs worth naming: state is overwritten wholesale rather than event-sourced, so concurrent edits are last-write-wins — deliberate for a game played by people sitting at one table. The backend is currently a hard dependency for boot; local-first persistence exists only for the creation wizard.

## Localization

Three languages (en/ru/uk), switchable at runtime. `src/locales/en.ts` is the structural type authority — `ru.ts` and `uk.ts` are typed against it, so a missing or extra key fails the build.

## Credits

Based on **World of Dungeons** by John Harper, itself a hack of *Dungeon World* by Sage LaTorra and Adam Koebel. Game text and equipment lists belong to their respective authors; this repository contains only the software.

## License

MIT — see [LICENSE](LICENSE).
