import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { gameGuard, gamePartyGuard, masterRouteGuard, partyGameRedirect, partyGuard } from '@/utils/routeGuards'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'

export function isGameMember(gameId: string): boolean {
  const me = currentUser.value?.id
  return !!me && useGamesStore().membersOf(gameId).some(m => m.user === me)
}

export function isGameMaster(gameId: string): boolean {
  return isMaster(useGamesStore().byId(gameId), currentUser.value?.id ?? null)
}

let quietExit: string | null = null

/**
 * Leaves or deletes a game on purpose: the bounce home while `exit` runs shows no "no longer in that
 * game" toast. The quiet ends once `exit` has settled, so a later removal still shows it.
 */
export async function exitGameQuietly<T>(gameId: string, exit: () => Promise<T>): Promise<T> {
  quietExit = gameId
  try {
    return await exit()
  } finally {
    // The re-check's redirect runs in the render flush that the store change scheduled; let it go first.
    await nextTick()
    if (quietExit === gameId) quietExit = null
  }
}

function notifyLeftGame(gameId: string): void {
  if (quietExit === gameId) return
  if (mode.value !== 'online') return
  useToastsStore().push(t('games.leftOrRemoved'), 'info')
}

const MASTER_ROUTES = new Set(['game-settings', 'game-monsters'])

interface Redirect {
  to: RouteLocationRaw
  leftGame?: string
}

/**
 * The game routes: members only; a party keeps the game's own characters; the settings and the
 * library are the master's, so a player (e.g. right after handing the role over) goes back to the table.
 */
export function gameRouteRedirect(name: string, gameId: string, ids: string | undefined, dataReady: boolean): Redirect | undefined {
  const toHome = gameGuard(gameId, isGameMember, dataReady)
  if (toHome) return { to: toHome, leftGame: gameId }
  if (MASTER_ROUTES.has(name)) {
    const toTable = masterRouteGuard(gameId, isGameMember, isGameMaster, dataReady)
    return toTable ? { to: toTable } : undefined
  }
  if (name !== 'game-party') return undefined
  const characters = useCharactersStore()
  const toParty = gamePartyGuard(gameId, ids, characters.getById, characters.metaOf, dataReady)
  return toParty ? { to: toParty } : undefined
}

/**
 * The party routes: online `party` is the table of free characters, and a character in a game opens that
 * game's table; offline `offline-party` keeps the device's own characters.
 */
export function partyRouteRedirect(ids: string | undefined, dataReady: boolean): RouteLocationRaw | undefined {
  const characters = useCharactersStore()
  if (mode.value !== 'online') return partyGuard(ids, characters.getById, dataReady, () => true, true)
  return partyGameRedirect(ids, characters.getById, characters.metaOf, dataReady)
    ?? partyGuard(ids, characters.getById, dataReady, c => characters.metaOf(c.id)?.game === '')
}

/** Follows a redirect from the route middleware; shows the "no longer in that game" toast when it leaves a game. */
export function applyRedirect(redirect: Redirect): RouteLocationRaw {
  if (redirect.leftGame !== undefined) notifyLeftGame(redirect.leftGame)
  return redirect.to
}

const GAME_ROUTES = new Set(['game', 'game-party', 'game-character-new', 'game-settings', 'game-monsters'])

/**
 * Re-runs the route middleware's checks while the page is open: once online data arrives (the
 * middleware lets a deep link through while it has not), and whenever membership or a character's
 * game changes, e.g. the player is removed or the game is deleted while its table is open.
 * Offline data is always "ready", but offline mode starts only on the way to /offline, so the page is leaving anyway.
 */
export function useRouteRecheck(): void {
  const route = useRoute()
  const router = useRouter()

  const redirect = computed<Redirect | undefined>(() => {
    if (!onlineDataReady.value || mode.value !== 'online') return undefined
    const name = String(route.name ?? '')
    const ids = route.params.ids as string | undefined
    if (name === 'party') {
      const to = partyRouteRedirect(ids, true)
      return to ? { to } : undefined
    }
    if (!GAME_ROUTES.has(name)) return undefined
    return gameRouteRedirect(name, String(route.params.gameId ?? ''), ids, true)
  })

  // The computed re-evaluates on every store change; act once per distinct target.
  let handled = ''
  watch(redirect, (next) => {
    const key = next ? JSON.stringify(next) : ''
    if (key === handled) return
    handled = key
    if (next) void router.replace(applyRedirect(next))
  }, { immediate: true })
}
