# App smoke checklist

The visual baseline renders components through Storybook and never runs Nuxt code, so it cannot catch app-level breakage (global CSS order, the `#__nuxt` root, `app.vue`, route middleware, bootstrap, PWA, realtime). Walk this list before a release or after any change to the app shell, routing, bootstrap, PWA or deploy config, once against `npm run dev` and once against the production output (`npm run build`, then serve `.output/public` with an SPA fallback), with PocketBase running (`./pocketbase serve` in `wodu-api/`). Record the result per item in the PR.

## Routes

- [ ] Cold load and refresh of every area: the landing `/`, the offline table `/offline` (and `/offline/new`, `/offline/party/:ids`), the cabinet `/games`, `/characters`, `/profile`, a game table `/games/:gameId`, the free-characters table `/party/:ids`, `/character/new`, `/character/:id/levelup`, `/join/<code>`.
- [ ] Landing `/`: never asks for an account. Signed out it shows "Sign in", signed in "Open cabinet"; both go to `/games`. "Play offline" goes to `/offline`. The EN/RU/UK buttons switch the language (and save it to the profile when signed in).
- [ ] Offline table `/offline`: works with no account and sends no request to PocketBase (DevTools network filter on the PocketBase host stays empty from the cold load on). The panel's "Home" goes to `/`; the panel footer keeps the language buttons.
- [ ] Sign-in gate: signed out, a cold deep link to `/games`, `/characters`, `/profile`, `/games/:gameId` or `/party/:ids` shows the sign-in screen and keeps the URL; after the code the same page opens. Its "Play offline" goes to `/offline`, its "← Home" link to `/`. `/join/<code>` signed out shows the game's name above the form.
- [ ] Cabinet header: Games and Characters mark the open page; "Offline table ↗" goes to `/offline`; the avatar opens `/profile`. On a phone the links take a second row.
- [ ] `/games`: Create game opens the new game's table; Join by code goes through `/join/<code>` to the joined game's table. `/characters`: every character and draft with where it is; Create character starts a free one.
- [ ] `/profile`: rename, language, the "App" install row only when the browser offers installation (Chrome, production output; check that it appears even though the profile is opened well after load), version. Sign out asks first, lands on `/` and the sign-in screen never flashes on `/profile`; Delete account asks with a danger confirm and lands on `/` the same way.
- [ ] The players panel's "Home": at a game table → `/games`, at the free-characters table → `/characters`, on `/join/<code>` → `/games`, offline → `/`.
- [ ] Closing the last sheet on the free-characters table (`/party/<id>`) goes to `/characters`; closing the last sheet at a game table goes to that game's table.
- [ ] `/character/new` without a creation draft returns to `/characters` (offline: `/offline`; the view does this, not a guard).
- [ ] `/character/:id` redirects to `/party/:id`.
- [ ] Cold deep link (fresh tab, typed URL) to `/party/:ids` and to `/character/:id/levelup` renders the screen.
- [ ] Party guard, cold deep link with a partly invalid party: `/party/<valid>,<missing>` lands on `/party/<valid>`; `/party/<missing>` and `/party/<draft>` land on `/games` (offline `/offline/party/<missing>` on `/offline`).
- [ ] Level-up guard: `/character/<missing>/levelup` and `/character/<draft>/levelup` land on `/games` (offline on `/offline`).
- [ ] Unknown URLs (`/does-not-exist`, `/character/x/y/z`): signed out the sign-in screen; signed in the dark layout (players panel, dice drawer) with an empty main area and no guard — the catch-all page `pages/[...slug].vue`, not Nuxt's 404 screen.
- [ ] Changing only the params of the open route keeps the view mounted: with `/party/a` open on the Inventory tab, adding a second character (`/party/a,b`) keeps the first sheet on Inventory.

## Gameplay

- [ ] Create a character through all three wizard steps; finishing lands on `/party/<new id>`.
- [ ] Resuming a persisted draft: refresh `/character/new` mid-wizard (step 2) — the same draft and step come back and no second draft is created. This relies on bootstrap finishing before the first navigation.
- [ ] Play: HP down/up, buy an item from the catalog, abilities listed on the Main tab; changes survive a reload.
- [ ] Stat roll from a stat chip: the 3D dice render, the roll reaches `roll_events` and the log.
- [ ] Dice asset path: the dice box is created with `assetPath` `/dice-assets/` (not `/_nuxt/dice-assets/`), and `/dice-assets/…` files are served with 200. In Storybook (`Layout/DiceDrawer`) the path is `./dice-assets/` and resolves with 200.
- [ ] Level-up: raise XP to the threshold, Level Up, roll hit dice, confirm; the character is level 2 and you are back on `/party/:id`.
- [ ] Locale switch EN → RU → UK → EN changes the UI and survives a reload. Signed in, the profile's language wins: switch on `/offline`, then open the cabinet, and the language goes back to the profile's.
- [ ] Realtime: two browser contexts on the same party; an HP change and a roll in one appear in the other without a reload.
- [ ] Footer shows the current `package.json` version.

## Offline mode and server failures

Run these against the production output: the service worker only exists there. Use a fresh browser profile per item (Playwright: a new persistent context), so an earlier mode, draft or worker does not leak in. `context.setOffline(true)` stands in for "no internet"; a route that never answers stands in for a hanging server.

- [ ] Offline campfire: with the worker controlling the page, open `/offline`, then cut the network. Create a character, roll a stat, apply damage, level up. Close the browser and relaunch it at `/offline` with no network: the worker serves the app, and the character, the rolls and the change log are all back. No request goes to PocketBase at any point under `/offline`.
- [ ] Separation: back online, open `/characters`. The list is exactly the server's characters and none of the offline ones. Start an online draft and take it to step 2, then go to `/offline` (the cabinet header's "Offline table ↗"): the offline table is shown and opening `/offline/new` resumes the offline draft, not the online one. Go back to `/characters`: the online draft resumes on step 2 through `/character/new`. (Create character always starts a fresh draft; resume through a draft card or the `/character/new` route.)
- [ ] Hanging server on start: with every request to PocketBase left unanswered, a cold load of `/party/<real id>` shows the server-unavailable overlay within about 6 s and the URL does not change. Once requests are answered again, the overlay goes away and the party opens. With PocketBase stopped instead (connection refused), the same overlay appears right after load; the page is never white or blank.
- [ ] Drop mid-game: in online mode with a sheet open, stop PocketBase. The overlay appears after the 3 s grace period, and clicks on the sheet under it do nothing. Start PocketBase again: the overlay goes and the data is reloaded. A roll from a second browser context then shows up exactly once in the first one's log (no duplicate subscriptions). A blip of about 1 s (stop and start right away) shows no overlay. A single write that fails at the network level while the server is healthy shows no overlay either: the change rolls back and the matching error toast appears once the 3 s check finds the server.
- [ ] No internet in online mode: open the installed app at a cabinet page (`/games`) with no network. The overlay says there is no internet connection, and Play offline goes to `/offline` and the app works there. In a session that loses the network, the overlay appears with the same text after the 3 s grace period and a failed health check, with no write needed, and goes away by itself within a second or two once the network is back, without Retry. A network handover (offline and back online within the grace period) shows no overlay. On `/offline` and on the landing `/`, losing the network shows nothing. For the offline background: after a second online visit (the first one loads the image before the worker controls the page), an offline relaunch still shows the layout background.

## PWA

- [ ] Docker image: cold load and refresh of `/character/new` behind the image (`docker build` + `docker run`) answers 200 with no redirect and `Cache-Control: no-cache`.
- [ ] Vite to Nuxt service-worker update path behind the real `nginx.conf`: an install of the previous Vite build picks up the new `sw.js` and shell after a reload.
- [ ] Install and update: an install of the current Vite build picks up the Nuxt build (new service worker, old precache cleaned, `/_nuxt/` assets not caught by the `/_` NetworkOnly and navigate-fallback denylist rules). Verified in the PWA task, not before.
