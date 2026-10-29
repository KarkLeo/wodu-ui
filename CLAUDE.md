# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive character sheet for the tabletop RPG **World of Dungeons** (©1979 J.S. Harper with C. McDowell, One & Seven Tactical Design Institute, Seattle, WA). Mobile-first web app with three interface modes: character creation, in-game play (single character or shared party view), and level-up flow. Online, characters live in games: a master and players share one table, and teammates' sheets open read-only.

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
- **Startup**: `app/plugins/02.bootstrap.client.ts` points PocketBase at `runtimeConfig.public.pbUrl` (from `VITE_PB_URL` at build time) and picks the mode from the first URL (`utils/routeMode.ts` `initialMode`: `/offline…` and the landing `/` start offline, everything else online; see *App modes*). In online mode it awaits `restoreSession()` (refreshes the saved sign-in) and then `bootstrap()` before the first navigation and render; `bootstrap()` does nothing while signed out, and `app.vue` shows the sign-in screen instead; `bootstrap()` subscribes to realtime and then fetches the data under one `BOOTSTRAP_TIMEOUT_MS` (6 s) deadline, so a hanging server delays the first render instead of blocking it. In offline mode it calls `startOfflineSession()` and sends nothing to PocketBase
- **State / Persistence**: Pinia. Where the data lives depends on the app mode (see *App modes*): online data lives on the server, offline data in localStorage. localStorage keys: `pocketbase_auth` (the SDK's sign-in token), `wod.offline.characters.v1`, `wod.offline.rolls.v1`, `wod.offline.changes.v1` (hand-rolled in `app/transport/offlineStorage.ts`), `wod.creation.v2` (`pinia-plugin-persistedstate`), `wod.locale.v1`. The old `wod.characters.v1`, `wod.rollHistory.v1`, `wod.creation.v1`, `wod.mode.v1` (the old mode switch) and `wod.home.tab.v1` (the old Home tabs) keys are dead; nothing reads them
- **UI Primitives**: [Reka UI](https://reka-ui.com/) (dropdowns, popovers, dialogs, tabs)
- **3D Dice**: `@3d-dice/dice-box-threejs` wrapped in `app/services/DiceAnimationQueue.ts`
- **Routing**: Nuxt file-based pages in `app/pages/` (vue-router underneath); guards are named route middleware in `app/middleware/` over pure functions in `app/utils/routeGuards.ts`
- **Tooling globals**: Storybook builds through `viteFinal` + `.storybook/vite.shared.ts`. `__APP_VERSION__` and `__BUILD_TIMESTAMP__` are frozen there on purpose (the visual baseline depends on them) — do not make them read `package.json`. A new global define or alias must be added to `nuxt.config.ts`, `vitest.config.ts` and `.storybook/vite.shared.ts`, and declared in `app/types/globals.d.ts`
- **Testing**: Vitest + happy-dom + `@vue/test-utils`. Coverage of **domain core only** — `app/utils/derived.ts`, `app/domain/reducer.ts` and the route guards in `app/utils/routeGuards.ts`. Do not add unit tests for UI/stores/composables — UI behaviour is covered by Storybook stories with `play` functions, which CI runs.

## Routes

Route names are set with `definePageMeta({ name })` and used by `router.push({ name })` and `app/stories/router.ts`; keep them stable.

Three areas, and the address decides the mode (*App modes*):

- **Public, no sign-in:** the landing `/` and the offline table under `/offline`.
- **Cabinet, sign-in required:** `/games`, `/characters`, `/profile`, the game tables, the free-characters table, `/join/<code>`. Signed out, `app.vue` shows the sign-in screen in place of the page and keeps the URL.

**Shells.** `app.vue` picks the frame from the page's `meta.shell` (typed in `app/types/router.d.ts`): `bare` renders the page alone, without panels and without the sign-in gate (the landing); `cabinet` renders it in `CabinetLayout` (the cabinet header, a centred column, no table panels) behind the gate; no `shell` means the table: `GameLayout` with `PlayersPanel` and `DiceDrawer`, behind the gate except under `/offline`. `app.vue` must read the route with vue-router's `useRoute`, not Nuxt's: Nuxt's follows the rendered page, and the sign-in screen renders none, so leaving it (back to the landing, "Play offline") would never update it.

| Route | Name | Page file | View | Notes |
|-------|------|-----------|------|-------|
| `/` | `landing` | `pages/index.vue` | `LandingView` | `shell: 'bare'`; public, never gated, belongs to no mode (keeps the running one; a cold start here runs offline). Title, tagline, "Sign in" (signed out) or "Open cabinet" (signed in) → `/games`, "Play offline" → `/offline`, EN/RU/UK (saved to the profile when signed in) |
| `/games` | `games` | `pages/games/index.vue` | `GamesView` (`GamesTab`) | `shell: 'cabinet'`; my games, Create game, Join by code |
| `/characters` | `characters` | `pages/characters.vue` | `CharactersView` (`CharactersTab`) | `shell: 'cabinet'`; my characters and drafts, where each is; Create character (a free one) |
| `/profile` | `profile` | `pages/profile.vue` | `ProfileView` | `shell: 'cabinet'`; name (`RenameSheet`), email, language, install ("App" row, when the browser offers it), version, sign out (confirm), delete account (danger confirm) |
| `/character/new` | `character-new` | `pages/character/new.vue` | `CharacterCreationView` | 3-step wizard; creates a free character; leaving it goes to `/characters` |
| `/character/:id` | `in-game` | `pages/character/[id]/index.vue` | — | redirects to `/party/:id` |
| `/party/:ids` | `party` | `pages/party/[ids].vue` | `PartyView` | the free-characters table; comma-separated ids; renders `InGameView` per character; `party` middleware drops draft/missing ids and ids that are not free; a character that is in a game redirects to `game-party`; closing the last sheet goes to `/characters` (the owner's decision), not to an empty table |
| `/character/:id/levelup` | `level-up` | `pages/character/[id]/levelup.vue` | `LevelUpView` | `level-up` middleware redirects if not `active` or not editable by me; scoped to the character's game |
| `/games/:gameId` | `game` | `pages/games/[gameId]/index.vue` | `CharacterListView` (game table, no sheet open) | `game` middleware: members only, else `/games` |
| `/games/:gameId/party/:ids` | `game-party` | `pages/games/[gameId]/party/[ids].vue` | `PartyView` | only that game's non-draft characters; teammates' sheets are read-only |
| `/games/:gameId/new` | `game-character-new` | `pages/games/[gameId]/new.vue` | `CharacterCreationView` | creates the character in the game |
| `/games/:gameId/settings` | `game-settings` | `pages/games/[gameId]/settings.vue` | `GameSettingsView` | `game` middleware: the master only (`masterRouteGuard`); a player goes to the game table, a non-member to `/games` |
| `/games/:gameId/monsters` | `game-monsters` | `pages/games/[gameId]/monsters.vue` | `MonsterLibraryView` | the master's monster library; same guard as the settings (`masterRouteGuard`) |
| `/join/:code` | `join` | `pages/join/[code].vue` | `JoinView` | cabinet route in the table layout; signed out, the sign-in screen shows the invite banner |
| `/offline` | `offline` | `pages/offline/index.vue` | `CharacterListView` | the offline table: the party's characters on this device |
| `/offline/party/:ids` | `offline-party` | `pages/offline/party/[ids].vue` | `PartyView` | `party` middleware |
| `/offline/new` | `offline-character-new` | `pages/offline/new.vue` | `CharacterCreationView` | |
| `/offline/character/:id/levelup` | `offline-level-up` | `pages/offline/character/[id]/levelup.vue` | `LevelUpView` | `level-up` middleware |
| anything else | `slug` | `pages/[...slug].vue` | — | a cabinet address (online, table layout): signed out it shows the sign-in screen, signed in the page renders nothing, so the layout stays (the old router had no catch-all) |

Navigation helpers live in `utils/scope.ts` (pure, unit-tested) and are reached through `useTable()`: `homeLocation` (where a guard turns people away: `/games`, or `/offline`), `tableLocation` (a game's table; outside games `/characters`; offline `/offline`), `partyLocation`, `newCharacterLocation`, `levelUpLocation`, and `panelHomeLocation` for the players panel's "Home" (a game's table and the invite page `/join/<code>` → `/games`, the free-characters table → `/characters`, the offline table → `/`). The game menu's "Home" also goes to `/games`.

## Data Model

Central type: `Character` (`app/types/character.ts`).

- `Stats` — six stats (`str/dex/con/int/wis/cha`), each stored as the **bonus** (not raw 2d6 roll)
- `StatModifier { id, statKey, amount, label }` — temporary buff/debuff stack on a stat
- `InventoryItem.descriptor: ItemDescriptor` — discriminated union: `weapon` (melee/ranged), `armor` (`class: 'none'|'light'|'full'`), `shield`, `gear`, `tool`, `occult`, `custom`. `equipped?: boolean` flags the active item.
- Library (`app/types/library.ts`): `LibraryMonster` and `LibraryItem`, the master's per-game entries. `checkMonster` / `checkItem` in `app/domain/library.ts` are the one shape check (normalise or return problems); `libraryItemToInventory` turns an item into an `InventoryItem` for `RECEIVE_ITEM`. `InventoryItem.libraryItemId` links a handed-out item to its library entry, and consumables stack by it; `templateId` stays reserved for the built-in gear catalog, and the two never stack with each other.
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

Two modes, and **the address decides which**: under `/offline` the offline mode, everywhere else (but the landing) the online one. There is no switch. Online and offline data are fully separate: nothing syncs, imports or exports between them.

- **Online**: the cabinet and the game tables, only for signed-in accounts (see *Accounts*). PocketBase is the store. Each account sees its own characters plus those of the games it is a member of: creates send `owner` and `game`, events send `character` and `game` (`transport/rows.ts`). The initial load comes from `bootstrap()`, realtime carries the account's other sessions and the other members of its games, and writes go to the server optimistically, rolling back on failure. No game data is kept on the device; only the creation draft pointer is.
- **Offline**: the offline table under `/offline`, no account needed. Characters, roll history and the change log live only on the device, under the `wod.offline.*` keys. Writes never roll back, and no request goes to PocketBase (the `CharacterListView` stories `OfflineTableSendsNothing` / `EnteringOfflineSendsNothing` and the `PanelFooter` `Offline` story check it). The panel shows an offline badge and a hint that clearing site data deletes these characters; its footer keeps the language buttons, since there is no profile offline.

Offline has no games, scope or read-only sheets: `canEditCharacter` is always true and the guards send people to `/offline`.

**How the mode follows the address.** `utils/routeMode.ts`: `modeForPath(path)` (`'offline'` under `/offline`, `null` for `/`, `'online'` otherwise) and `initialMode(path)` for the bootstrap plugin. The global middleware `middleware/mode.global.ts` calls `transport/modeSwitch.ts` `enterMode(modeForPath(to.path))` on every navigation: stop the current mode, `setMode` (bumps `modeSession`), clear the three stores, then `startOfflineSession()` or `restoreSession()` + `bootstrap()`. Global middleware runs before a page's own, so the target's guards see its data. The creation draft pointer (`wod.creation.v2`) is kept per mode, so each mode resumes its own draft.

**The mode switches in `beforeEach`, before the navigation commits.** The old page is still mounted in the new mode until the new one renders, and an aborted guard or a failed lazy chunk would leave the old page in the new mode. So a mounted view that reacts to `mode` or `onlineDataReady` (they flip at the switch: offline data counts as loaded at once) must check the mode it was opened in before acting, as `JoinView`, `CharacterCreationView` and `useRouteRecheck` do. No current guard redirects across areas.

- `mode.ts` — `mode` ref, `setMode`, and `modeSession()`, a counter that lets an in-flight online write detect a mode switch and drop its result
- `backend.ts` — the `Backend` interface the stores and the dice roller write through; `backend()` returns `pbBackend` or `localBackend` for the current mode
- `bootstrap.ts` — online load (subscribe first, then fetch, under one timeout; realtime events that arrive during the fetch are replayed on top of it), `reloadOnline()` after a reconnect, `stopOnline()`; exports `onlineDataReady`, which the route guards and the character list wait for
- `connection.ts` — `connection` state (`ok` / `checking` / `down`). A network failure (failed write, realtime drop, the browser firing `offline`) starts a `GRACE_MS` (3 s) grace period that ends with one `/api/health` check: if the server answers, the state goes back to `ok` and no overlay is shown (a single failed write or a Wi-Fi/cellular handover never raises it); only if the check fails does it go `down`, and a backoff loop then probes `/api/health`, reloads and resubscribes when it answers. The browser's `online` event triggers a check at once (`probeNow()`). `problemOutcome()` tells a failed write how the problem ended, so `transport/writeFailure.ts` shows the `errors.*Failed` toast when the server was reachable after all (the change was rolled back) and leaves it to the overlay otherwise
- `writeFailure.ts` — `reportWriteFailure(err, message, session)`, the toast policy for rolled-back writes described above
- `offlineStorage.ts` — offline load, persistence watcher, toasts for unreadable data or a failed write; picks up changes another offline tab writes (`storage` event) instead of overwriting them
- `modeSwitch.ts` — `enterMode(next)` and `startOfflineSession()` (see above)
- `scope.ts` — `scope` ref (`home` | `solo` | `game`) and `setScope`. `app.vue` sets it from the route (`useTable().tableScope`, from `utils/scope.ts` `scopeForRoute`): `game`, `game-party`, `game-character-new`, `game-settings`, `game-monsters` → that game; online `party` → `solo`; `level-up` → its character's game; everything else (the cabinet pages included) and all of offline → `home`. All visible characters are loaded up front; only roll/change events matching `eventFilter(scope)` are fetched (home fetches none), and realtime events failing `eventInScope` are dropped; a scope change reloads the two event stores and re-reads the game's characters
- `games.ts` — online-only game operations, each through `guard()` with the bootstrap timeout and a `staysCurrent()` check (same mode session and user): `findGameByCode` (list endpoint filtered by `invite_code`, works signed out), `createGame` (game, then own membership; the game is deleted if the membership fails; code collisions retry), `joinGame` (game into the store, membership with the code, then `loadGame`), `leaveGame` (free own characters there, delete membership, `forgetGame`), `removeMember` (free that member's characters, drop them locally, delete membership), `resetInviteCode`, `renameGame(gameId, name)` (trimmed, 1–80 characters as on create, `utils/gameName.ts`), `transferMaster(gameId, userId)` (only to another member; the store takes the new master as soon as the server answers, realtime brings it to the others), `deleteGame`, `claimMaster` (update `master`, read back; `MasterTakenError` if someone else won), `moveCharacter(id, gameId)` (`''` takes it out), `assignCharacter(id, userId)`. `forgetGame` drops a game, its members and teammates' characters locally, because the server sends nothing for records that stop being readable. `healStuckCharacters(gameId?)` (after every load and in `forgetGame`) takes my characters out of a game I am not a member of (`moveCharacter(id, '')`): the server hides them and refuses their rolls until then
- `onlineOps.ts` — `call` (guard + bootstrap timeout), `requireOnlineUser`, `staysCurrent`, shared by `games.ts` and `library.ts`
- `library.ts` — the master's monster library (WODU-8): `loadMonsters(gameId)` (into `useLibraryStore`; entries failing `checkMonster` or whose `data.id` differs from the record are dropped; a failure leaves the store `failed`), `createMonster`, `updateMonster` (sends only `data`), `deleteMonster(gameId, id)` (the server answers 404 both for a gone entry and for a non-master, so a 404 re-reads the game: still the master → deleted; otherwise the new master goes into the store and the delete fails). Loaded when the screen opens (and again after a server outage), not by `bootstrap()`, and no realtime subscription: only the master reads the collection, so the only other writer is the master's own other device
- `pb.ts` (client and row types), `shapes.ts` (shape checks for stored data), `limits.ts` (`HISTORY_LIMIT`)

## Accounts (`app/transport/auth.ts`, `app/features/sign-in/`)

The cabinet and the game tables need a signed-in, verified account; the landing and the offline table never ask for one. Sign-in is a one-time email code only (PocketBase OTP on `users`, 8 digits, 3 minutes). PocketBase sends a code only to an existing user, so `requestCode()` first creates the user with a random throwaway password and ignores "email already exists". A successful code sign-in marks the account verified. Stored per user: `email`, `name`, `language`.

- `authHelpers.ts` — pure helpers with unit tests: email/code sanitising, `defaultDisplayName`, error classifiers, `resolveLanguage`, `authGate(path, signedIn, name)` → `'sign-in' | 'name' | 'none'` (`'none'` for `/` and `/offline…`; the cabinet shell and the table shell both go through it)
- `auth.ts` — `currentUser`, `signedIn`, `requestCode`, `verifyCode`, `restoreSession()` (`'signed-in' | 'signed-out' | 'unreachable'`: 401/403 signs out; a network failure, a 5xx or a 404 — Traefik's answer while the backend redeploys — keeps the token and lets the overlay handle it), `updateProfile`, `deleteOwnAccount`, `clearSession`
- `session.ts` — `watchSession()` (started by the bootstrap plugin) is the one place that reacts to the sign-in state: signed in → `bootstrap()`, signed out → stop the online session and clear the three stores. It also catches sign-in/out in another tab, which the SDK syncs through the `storage` event. `bootstrap()` and every reload check `canLoadOnline(mode, signedIn)`, so a reconnect after sign-out loads nothing
- `app.vue` renders `SignInView` (email → code, or the display-name step when `name` is empty) in place of the cabinet or table layout while `authGate` is not `'none'`; the URL is kept, so a deep link opens after sign-in. Its "Play offline" (and the server-down overlay's) navigates to `/offline`; the email step's "← Home" link goes to the landing `/`
- Language: on sign-in an empty profile language takes the device's; afterwards the profile wins, and the locale buttons (profile, sign-in screen, landing) write to it while signed in (`useAccount().setLanguage`): in online mode, and on the landing in either mode (a cold start at `/` runs offline). The offline table's buttons never write to it, so entering the cabinet from `/offline` resets the language to the profile's (`restoreSession()` → `syncLanguage`)
- **Profile** (`/profile`, `features/profile/`): change name (`RenameSheet`), email, language, install, version, sign out (gold confirm), delete account (danger confirm; games the account runs stay, masterless). Sign out and delete first land on `/` (never gated) and only then clear the session (`watchSession` stops the online session and clears the three stores), so the sign-in screen never shows on `/profile`; `deleteOwnAccount` therefore deletes through `pb.send`, not `collection('users').delete()`, which would end the session itself. Offline data is untouched. The install row reads state that `pwa/useInstall.ts` collects from startup (`listenForInstallPrompt()` in `plugins/04.pwa-register.client.ts`): the browser fires `beforeinstallprompt` once per page load, long before the profile opens
- Stories use the in-memory auth in `.storybook/mocks/pb.ts` (`signInMock()`, `WRONG_CODE`)

**Server unavailable.** In online mode, while `connection === 'down'`, `app.vue` shows `ServerDownOverlay`: a Reka alert dialog over a blurred veil, with the app underneath made `inert`. It shows a reconnect counter, **Retry** and **Play offline** (navigates to `/offline`); it is never shown on the landing or the offline table; with no internet (`navigator.onLine` false) the text says so. It disappears on its own once the server answers and the data is reloaded. The route guards do not redirect away from a deep link while online data has not loaded; the party and level-up pages re-check once it has.

## Stores (`app/stores/`)

The game-data stores (characters, roll history, change log) do not persist themselves; the app mode decides where their data comes from and goes. Only the creation store persists itself, through `pinia-plugin-persistedstate`.

- `useCharactersStore` — State: `list`, `activeId`, `meta` (`Record<id, CharacterMeta>` = `{ owner, game }`, online only). Getters: `active`, `getById(id)`, `metaOf(id)` and `metaView` (both normalise a game unknown to the store to free, `game: ''`; raw `meta` holds the stored value and is for transport bookkeeping), `inScope(id)` (at the open table; offline always true), `canEditCharacter(id)` (offline always true). Actions: `add`, `dispatch(id, cmd)`, `remove`, `setActive`; a scope change clears an `activeId` that is not in the new scope, and the Dice drawer rolls only for an active character in scope. Auto-records change-log entries on `dispatch` for active characters. `dispatch` refuses a character I cannot edit (error toast `errors.readOnly`, no write); a write that fails with 404 on a teammate's character drops it locally with `errors.characterGone` instead of rolling back.
- `useGamesStore` — `games`, `members` (with the user's display name from `expand: 'user'`). Getters `byId`, `membersOf(gameId)`, `active` (the game of the current scope). Filled by `bootstrap()`, realtime (`games`, `game_members`) and `transport/games.ts`
- `useLibraryStore` — one game's library at a time: `gameId`, `monsters`, `status` (`idle` / `loading` / `ready` / `failed`); filled by `transport/library.ts`; cleared by `stopOnline()`, and by `useGamesStore` whenever that game's master changes or the game goes (`setAll`, `upsertGame`, `removeGame`), so a former master never keeps the list
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
- `useTable()` — `tableScope`, `gameId`, `game`, `tableRoute()`, `partyRoute(ids)`, `newCharacterRoute()`, `levelUpRoute(id)`, derived from the route and the mode; use it instead of hardcoding route names
- `useRouteRecheck()` — page-level re-check of the route guards when online data arrives or membership/meta changes; a member removed (or a game deleted) while its table is open lands on `/games` with the `games.leftOrRemoved` toast; whoever stops being the master (a transfer, here or from another device) while the settings or the monster library are open goes back to the game table. A voluntary leave/delete runs inside `exitGameQuietly(gameId, fn)` to skip the toast
- `useSheetReadonly()` — read-only flag provided by `InGameView` (`provideSheetReadonly`, `!canEditCharacter(id)`); each sheet panel reads it and hides edit controls and dice
- `useAccount()` — `user`, `signedIn`, `requestCode`, `signIn` (code, then `bootstrap()`), `rename`, `setLanguage`, `signOut` (to `/`, then ends the session), `deleteAccount`

## Features (`app/features/`)

Feature-based folder structure:

- `sign-in/` — `SignInView` + `steps/` (EmailStep, CodeStep, NameStep), `AuthScreen`, `AuthField`
- `landing/` — `LandingView`
- `cabinet/` — `CabinetLayout` (shell: `CabinetHeader` + centred column), `CabinetHeader` ("World of Dungeons", Games · Characters with the open one marked `aria-current`, a separate "Offline table ↗" link, the profile avatar; on phones the links take a second row), `GamesView` (`GamesTab`), `CharactersView` (`CharactersTab`), `CreateGameSheet`, `JoinByCodeSheet`; shared styles in `cabinet.css`
- `profile/` — `ProfileView`, `RenameSheet`, `accountError.ts`
- `join/` — `JoinView` (checking, invite not valid, already a member, joining, failed)
- `game-settings/` — `GameSettingsView` (the master's screen: name, invite, members with remove / make master, delete game)
- `monster-library/` — `MonsterLibraryView` (search over name, special and notes via `searchMonsters` in `domain/library.ts`, sorted by name; New monster; empty, no-match, loading and load-failed states; reloads after a server outage, and a failed reload keeps the list with a notice and Try again), `MonsterRow` (accordion row: name and HP / armor / damage chips closed; special, notes, Edit, Duplicate, Delete open; one row open at a time), `MonsterSheet` (add / edit / duplicate form in a `BottomSheet`; field errors from `checkMonster` problems after the first save attempt; a variant starts as "<name> (copy)", the name cut short by `copyName` to fit 80 characters)
- `character-list/` — `CharacterListView` (the offline table at `/offline`; online the game table, only my drafts)
- `character-creation/` — `CharacterCreationView` + `steps/` (StepIdentity, StepTraining, StepGear)
- `in-game/` — `PartyView`, `InGameView`, `components/` (StatusHeader, StatsPanel, SkillsPanel, AbilitiesPanel, InventoryPanel + `inventory/` subcomponents, MagicPanel + `magic/` subcomponents, NotesPanel)
- `level-up/` — `LevelUpView` + `components/` (StepStat, StepHitDice, StepSkill, StepAbility, StepSummary)

## UI Primitives (`app/components/ui/`)

Thin wrappers around Reka UI for project-specific styling: `Button`, `BottomSheet`, `ConfirmSheet`, `InfoPopover`, `Stepper`, `TabBar`, `HpBar`, `XpBar`, `StatChip`, `SkillChip`, `StatusChip`, `StatusChipTrio`, `AbilityCard`, `FormCheckbox`, `SegmentedFilter`, plus `icons/`. Table UI in `components/layout/`: `GameLayout`, `PlayersPanel` with `PanelFooter` at its bottom ("Home" per `panelHomeLocation`, the version line, and offline the language buttons), `GameMenu`, `InvitePanel` (code, link, copy, reset for the master) inside `InviteSheet`, `MembersList` (remove and make master for the master) inside `MembersSheet`, `BringCharacterSheet`, `GiveCharacterSheet`, `MasterlessNotice`. The settings screen uses the same `InvitePanel` and `MembersList`.

**`InfoPopover` rule:** `PopoverPortal` teleports content to `<body>`, bypassing Vue scoped CSS. Style `.info-content` in a non-scoped `<style>` block (currently lives in `app/assets/main.css`). Do not duplicate breakdown popovers — assemble breakdowns inline using `InfoPopover` + the `*BreakdownLines` helpers from `derived.ts`.

The in-game `StatusHeader` shows HP / XP / armor / equipped weapon damage with `InfoPopover` breakdowns. Armor and damage are read-only in the header — armor type is set by equipping items in the Inventory panel.

In-game tabs (`inGame.tabs.*`): **Main** (stats/skills/abilities) → **Inventory** → optionally **Magic** → **Notes**. There is no Combat tab.

## Games and permissions

Games exist online only; the server is the authority (see the workspace `CLAUDE.md`), the client mirrors its rules. `utils/permissions.ts` `canEdit(meta, me, game, members)`: the owner always edits; a master edits a player's character only while that owner is still a member of the game; everyone else reads. Nothing outside the stores decides this: `dispatch` and `useDiceRoller` (`roll`, `rollBatch`) both check `canEditCharacter` and refuse with `errors.readOnly` (no write, no animation, no history). The UI hides the controls through `useSheetReadonly()`, so the guards are the second line.

- Invite code: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, shown `XXXX-XXXX`, link `<origin>/join/<code>`; input accepts lowercase, spaces and the dash (`utils/inviteCode.ts`).
- Join: `/join/<code>` signed out → `app.vue` looks the code up (`findGameByCode`) and shows the game name as a banner on the sign-in screen; the URL survives sign-in. A reset or wrong code shows "invite not valid" with a way home, never a half-join.
- Game table: players panel lists the game's characters (owner name per row), head with role pill and `GameMenu`: for the master Game settings, Monster library, Bring one of mine, Home; for a player (and everyone in a masterless game) Invite and Members read-only, Bring one of mine, Home, Leave.
- Game settings (`game-settings`, master only): rename (Save disabled while unchanged or invalid; inline "Saved." / failure), invite (`InvitePanel`), members (`MembersList`: Remove and Make master, each behind a danger confirm), delete game (danger confirm, `exitGameQuietly`). **Master transfer**: `transferMaster` sets `games.master` to another member (the server refuses non-members); the former master lands on the game table with `games.members.transferred`, keeps their own characters and from then on reads the others' sheets read-only. A masterless game shows `MasterlessNotice`; "Become master" races are decided by the server, the loser gets `games.claim.taken`.
- Per sheet (`SheetActions`): "Take out of the game", and for the master "Give to a player", on my own characters only.

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
