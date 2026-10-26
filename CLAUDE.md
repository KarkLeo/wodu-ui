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
- **Startup**: `app/plugins/02.bootstrap.client.ts` points PocketBase at `runtimeConfig.public.pbUrl` (from `VITE_PB_URL` at build time). In online mode it awaits `restoreSession()` (refreshes the saved sign-in) and then `bootstrap()` before the first navigation and render; `bootstrap()` does nothing while signed out, and `app.vue` shows the sign-in screen instead; `bootstrap()` subscribes to realtime and then fetches the data under one `BOOTSTRAP_TIMEOUT_MS` (6 s) deadline, so a hanging server delays the first render instead of blocking it. In offline mode it calls `startOfflineSession()` and sends nothing to PocketBase
- **State / Persistence**: Pinia. Where the data lives depends on the app mode (see *App modes*): online data lives on the server, offline data in localStorage. localStorage keys: `pocketbase_auth` (the SDK's sign-in token), `wod.mode.v1`, `wod.offline.characters.v1`, `wod.offline.rolls.v1`, `wod.offline.changes.v1` (hand-rolled in `app/transport/offlineStorage.ts`), `wod.creation.v2` (`pinia-plugin-persistedstate`), `wod.locale.v1`. The old `wod.characters.v1`, `wod.rollHistory.v1` and `wod.creation.v1` keys are dead; nothing reads them
- **UI Primitives**: [Reka UI](https://reka-ui.com/) (dropdowns, popovers, dialogs, tabs)
- **3D Dice**: `@3d-dice/dice-box-threejs` wrapped in `app/services/DiceAnimationQueue.ts`
- **Routing**: Nuxt file-based pages in `app/pages/` (vue-router underneath); guards are named route middleware in `app/middleware/` over pure functions in `app/utils/routeGuards.ts`
- **Tooling globals**: Storybook builds through `viteFinal` + `.storybook/vite.shared.ts`. `__APP_VERSION__` and `__BUILD_TIMESTAMP__` are frozen there on purpose (the visual baseline depends on them) — do not make them read `package.json`. A new global define or alias must be added to `nuxt.config.ts`, `vitest.config.ts` and `.storybook/vite.shared.ts`, and declared in `app/types/globals.d.ts`
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

Flow: composable → `store.dispatch(id, cmd)` → `applyCommand` → `backend()` write (PocketBase online, localStorage offline). The creation wizard dispatches draft-only commands the same way.

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

## App modes (`app/transport/`)

Two modes, switched in the players panel footer (`ModeSwitch`, above the language buttons) and remembered under `wod.mode.v1`. Online and offline data are fully separate: nothing syncs, imports or exports between them.

- **Online** (default): only for signed-in accounts (see *Accounts*). PocketBase is the store. Each account sees only its own characters (and their rolls and changes) until games arrive: creates send `owner` and events send `character` (`transport/rows.ts`). The initial load comes from `bootstrap()`, realtime keeps other players' changes coming in, and writes go to the server optimistically, rolling back on failure. No game data is kept on the device; only the creation draft pointer is.
- **Offline**: characters, roll history and the change log live only on the device, under the `wod.offline.*` keys. Writes never roll back, and no request goes to PocketBase. The panel shows an offline badge and a hint that clearing site data deletes these characters.

Switching goes through `useModeSwitch().switchMode()`: stop the current mode, clear the three stores, go to `/`, load the other mode. The creation draft pointer (`wod.creation.v2`) is kept per mode, so each mode resumes its own draft.

- `mode.ts` — `mode` ref, `setMode`, and `modeSession()`, a counter that lets an in-flight online write detect a mode switch and drop its result
- `backend.ts` — the `Backend` interface the stores and the dice roller write through; `backend()` returns `pbBackend` or `localBackend` for the current mode
- `bootstrap.ts` — online load (subscribe first, then fetch, under one timeout; realtime events that arrive during the fetch are replayed on top of it), `reloadOnline()` after a reconnect, `stopOnline()`; exports `onlineDataReady`, which the route guards and the character list wait for
- `connection.ts` — `connection` state (`ok` / `checking` / `down`). A network failure (failed write, realtime drop, the browser firing `offline`) starts a `GRACE_MS` (3 s) grace period that ends with one `/api/health` check: if the server answers, the state goes back to `ok` and no overlay is shown (a single failed write or a Wi-Fi/cellular handover never raises it); only if the check fails does it go `down`, and a backoff loop then probes `/api/health`, reloads and resubscribes when it answers. The browser's `online` event triggers a check at once (`probeNow()`). `problemOutcome()` tells a failed write how the problem ended, so `transport/writeFailure.ts` shows the `errors.*Failed` toast when the server was reachable after all (the change was rolled back) and leaves it to the overlay otherwise
- `writeFailure.ts` — `reportWriteFailure(err, message, session)`, the toast policy for rolled-back writes described above
- `offlineStorage.ts` — offline load, persistence watcher, toasts for unreadable data or a failed write; picks up changes another offline tab writes (`storage` event) instead of overwriting them
- `pb.ts` (client and row types), `shapes.ts` (shape checks for stored data), `limits.ts` (`HISTORY_LIMIT`)

## Accounts (`app/transport/auth.ts`, `app/features/sign-in/`)

Online mode needs a signed-in, verified account; offline mode never asks for one. Sign-in is a one-time email code only (PocketBase OTP on `users`, 8 digits, 3 minutes). PocketBase sends a code only to an existing user, so `requestCode()` first creates the user with a random throwaway password and ignores "email already exists". A successful code sign-in marks the account verified. Stored per user: `email`, `name`, `language`.

- `authHelpers.ts` — pure helpers with unit tests: email/code sanitising, `defaultDisplayName`, error classifiers, `resolveLanguage`, `authGate(mode, signedIn, name)` → `'sign-in' | 'name' | 'none'`
- `auth.ts` — `currentUser`, `signedIn`, `requestCode`, `verifyCode`, `restoreSession()` (`'signed-in' | 'signed-out' | 'unreachable'`: 401/403 signs out; a network failure, a 5xx or a 404 — Traefik's answer while the backend redeploys — keeps the token and lets the overlay handle it), `updateProfile`, `deleteOwnAccount`, `clearSession`
- `session.ts` — `watchSession()` (started by the bootstrap plugin) is the one place that reacts to the sign-in state: signed in → `bootstrap()`, signed out → stop the online session and clear the three stores. It also catches sign-in/out in another tab, which the SDK syncs through the `storage` event. `bootstrap()` and every reload check `canLoadOnline(mode, signedIn)`, so a reconnect after sign-out loads nothing
- `app.vue` renders `SignInView` (email → code, or the display-name step when `name` is empty) in place of `GameLayout` while `authGate` is not `'none'`; the URL is kept, so a deep link opens after sign-in
- Language: on sign-in an empty profile language takes the device's; afterwards the profile wins, and the locale buttons write to it while signed in (`useAccount().setLanguage`)
- `AccountMenu` (players-panel footer, online only): change name, sign out, delete account. Sign out and delete stop the online session and clear the three stores; offline data is untouched
- Stories use the in-memory auth in `.storybook/mocks/pb.ts` (`signInMock()`, `WRONG_CODE`)

**Server unavailable.** In online mode, while `connection === 'down'`, `app.vue` shows `ServerDownOverlay`: a Reka alert dialog over a blurred veil, with the app underneath made `inert`. It shows a reconnect counter, **Retry** and **Play offline** (switches mode at once); with no internet (`navigator.onLine` false) the text says so. It disappears on its own once the server answers and the data is reloaded. The route guards do not redirect away from a deep link while online data has not loaded; the party and level-up pages re-check once it has.

## Stores (`app/stores/`)

The game-data stores (characters, roll history, change log) do not persist themselves; the app mode decides where their data comes from and goes. Only the creation store persists itself, through `pinia-plugin-persistedstate`.

- `useCharactersStore` — State: `list`, `activeId`. Getters: `active`, `getById(id)`. Actions: `add`, `dispatch(id, cmd)`, `remove`, `setActive`. Auto-records change-log entries on `dispatch` for active characters.
- `useCreationStore` — wizard state per mode: `draftId`, `step` (1–3), persisted under `wod.creation.v2`
- `useChangeLogStore` — recent gameplay changes (HP, XP, inventory) for the unified log
- `useRollHistoryStore` — dice roll history (3D dice rolls + manual)

## Composables (`app/composables/`)

- `useActiveCharacter()` — reactive char + `dispatch` bound to route id
- `useInventory(dispatch)` — inventory command helpers
- `useLevelUp(char, dispatch)` — level-up state machine
- `useCharacterCreation()` — wizard flow + draft lifecycle
- `useDiceRoller()` — single source of truth for 3D dice rolls; coordinates with `DiceBoxService`. Holds the only "is rolling" lock — components should not roll directly.
- `useMercury(char, dispatch)` — quicksilver overdose UI flow (the gear use-effect)
- `useUnifiedLog()` — merged feed of change log + roll history for the in-game log panel
- `useModeSwitch()` — `switchMode(next)`; also exports `startOfflineSession()`, which the bootstrap plugin uses
- `useAccount()` — `user`, `signedIn`, `requestCode`, `signIn` (code, then `bootstrap()`), `rename`, `setLanguage`, `signOut`, `deleteAccount`

## Features (`app/features/`)

Feature-based folder structure:

- `sign-in/` — `SignInView` + `steps/` (EmailStep, CodeStep, NameStep), `AuthScreen`, `AuthField`
- `character-list/` — `CharacterListView`
- `character-creation/` — `CharacterCreationView` + `steps/` (StepIdentity, StepTraining, StepGear)
- `in-game/` — `PartyView`, `InGameView`, `components/` (StatusHeader, StatsPanel, SkillsPanel, AbilitiesPanel, InventoryPanel + `inventory/` subcomponents, MagicPanel + `magic/` subcomponents, NotesPanel)
- `level-up/` — `LevelUpView` + `components/` (StepStat, StepHitDice, StepSkill, StepAbility, StepSummary)

## UI Primitives (`app/components/ui/`)

Thin wrappers around Reka UI for project-specific styling: `Button`, `BottomSheet`, `ConfirmSheet`, `InfoPopover`, `Stepper`, `TabBar`, `HpBar`, `XpBar`, `StatChip`, `SkillChip`, `StatusChip`, `StatusChipTrio`, `AbilityCard`, `FormCheckbox`, `SegmentedFilter`, `ModeSwitch`, plus `icons/`.

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
- Offline data survives page refresh and browser restarts (localStorage); online data lives on the server and is reloaded on start
- Domain command dispatch is the only path for gameplay mutations
- Bump `version` in `package.json` (patch by default) whenever you change code — the in-app footer surfaces it via `__APP_VERSION__`, so a stale version means stale UI for users
