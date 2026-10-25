# App smoke checklist

The visual baseline renders components through Storybook and never runs Nuxt code, so it cannot catch app-level breakage (global CSS order, the `#__nuxt` root, `app.vue`, route middleware, bootstrap, PWA, realtime). Walk this list before a release or after any change to the app shell, routing, bootstrap, PWA or deploy config, once against `npm run dev` and once against the production output (`npm run build`, then serve `.output/public` with an SPA fallback), with PocketBase running (`./pocketbase serve` in `wodu-api/`). Record the result per item in the PR.

## Routes

- [ ] Cold load and refresh of every route: `/`, `/character/new`, `/party/:ids`, `/character/:id/levelup`.
- [ ] `/character/new` without a creation draft returns to `/` (the view does this, not a guard).
- [ ] `/character/:id` redirects to `/party/:id`.
- [ ] Cold deep link (fresh tab, typed URL) to `/party/:ids` and to `/character/:id/levelup` renders the screen.
- [ ] Party guard, cold deep link with a partly invalid party: `/party/<valid>,<missing>` lands on `/party/<valid>`; `/party/<missing>` and `/party/<draft>` land on `/`.
- [ ] Level-up guard: `/character/<missing>/levelup` and `/character/<draft>/levelup` land on `/`.
- [ ] Unknown URLs (`/does-not-exist`, `/character/x/y/z`) keep the dark layout (players panel, dice drawer) with an empty main area and run no guard — the catch-all page `pages/[...slug].vue`, not Nuxt's 404 screen.
- [ ] Changing only the params of the open route keeps the view mounted: with `/party/a` open on the Inventory tab, adding a second character (`/party/a,b`) keeps the first sheet on Inventory.

## Gameplay

- [ ] Create a character through all three wizard steps; finishing lands on `/party/<new id>`.
- [ ] Resuming a persisted draft: refresh `/character/new` mid-wizard (step 2) — the same draft and step come back and no second draft is created. This relies on bootstrap finishing before the first navigation.
- [ ] Play: HP down/up, buy an item from the catalog, abilities listed on the Main tab; changes survive a reload.
- [ ] Stat roll from a stat chip: the 3D dice render, the roll reaches `roll_events` and the log.
- [ ] Dice asset path: the dice box is created with `assetPath` `/dice-assets/` (not `/_nuxt/dice-assets/`), and `/dice-assets/…` files are served with 200. In Storybook (`Layout/DiceDrawer`) the path is `./dice-assets/` and resolves with 200.
- [ ] Level-up: raise XP to the threshold, Level Up, roll hit dice, confirm; the character is level 2 and you are back on `/party/:id`.
- [ ] Locale switch EN → RU → UK → EN changes the UI and survives a reload.
- [ ] Realtime: two browser contexts on the same party; an HP change and a roll in one appear in the other without a reload.
- [ ] Footer shows the current `package.json` version.

## Offline mode and server failures

Run these against the production output: the service worker only exists there. Use a fresh browser profile per item (Playwright: a new persistent context), so an earlier mode, draft or worker does not leak in. `context.setOffline(true)` stands in for "no internet"; a route that never answers stands in for a hanging server.

- [ ] Offline campfire: with the worker controlling the page, switch to Offline, then cut the network. Create a character, roll a stat, apply damage, level up. Close the browser and relaunch it with no network: the worker serves the app, and the character, the rolls and the change log are all back. No request goes to PocketBase at any point after the switch.
- [ ] Separation: back online, switch to Online. The list is exactly the server's characters and none of the offline ones. Start an online draft and take it to step 2, then switch to Offline: the offline list is shown and opening `/character/new` resumes the offline draft, not the online one. Switch back: the online draft resumes on step 2. (The New character button always starts a fresh draft; resume through a draft card or the `/character/new` route.)
- [ ] Hanging server on start: with every request to PocketBase left unanswered, a cold load of `/party/<real id>` shows the server-unavailable overlay within about 8 s and the URL does not change. Once requests are answered again, the overlay goes away and the party opens. With PocketBase stopped instead (connection refused), the same overlay appears right after load; the page is never white or blank.
- [ ] Drop mid-game: in online mode with a sheet open, stop PocketBase. The overlay appears after the 3 s grace period, and clicks on the sheet under it do nothing. Start PocketBase again: the overlay goes and the data is reloaded. A roll from a second browser context then shows up exactly once in the first one's log (no duplicate subscriptions). A blip of about 1 s (stop and start right away) shows no overlay.
- [ ] No internet in online mode: open the installed app with no network while the switch is on Online. The overlay says there is no internet connection, and Play offline switches to Offline and the app works. In a session that loses the network, the overlay appears with the same text after the 3 s grace period, with no write needed, and goes away by itself once the network is back. In Offline mode, losing the network shows nothing. For the offline background: after a second online visit (the first one loads the image before the worker controls the page), an offline relaunch still shows the layout background.

## PWA

- [ ] Docker image: cold load and refresh of `/character/new` behind the image (`docker build` + `docker run`) answers 200 with no redirect and `Cache-Control: no-cache`.
- [ ] Vite to Nuxt service-worker update path behind the real `nginx.conf`: an install of the previous Vite build picks up the new `sw.js` and shell after a reload.
- [ ] Install and update: an install of the current Vite build picks up the Nuxt build (new service worker, old precache cleaned, `/_nuxt/` assets not caught by the `/_` NetworkOnly and navigate-fallback denylist rules). Verified in the PWA task, not before.
