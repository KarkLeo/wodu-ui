import { computed } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { mode } from '@/transport/mode'
import { partyLocation, scopeForRoute, tableLocation } from '@/utils/scope'

/**
 * The table the current route shows (a game's, or the one outside games) and where its navigation
 * goes, so opening and closing sheets or leaving the creation wizard stays on that table.
 */
export function useTable() {
  const route = useRoute()
  const games = useGamesStore()
  const characters = useCharactersStore()

  // The level-up route names only its character; its table is that character's game (metaOf counts a
  // game the player no longer knows as none).
  const characterGame = computed(() => {
    if (route.name !== 'level-up') return ''
    return characters.metaOf(String(route.params.id ?? ''))?.game ?? ''
  })

  const tableScope = computed(() => scopeForRoute(
    String(route.name ?? ''),
    route.params.gameId as string | undefined,
    mode.value === 'online',
    characterGame.value,
  ))
  const gameId = computed(() => (tableScope.value.kind === 'game' ? tableScope.value.gameId : null))
  const game = computed(() => (gameId.value ? games.byId(gameId.value) : undefined))

  return {
    tableScope,
    gameId,
    game,
    tableRoute: (): RouteLocationRaw => tableLocation(tableScope.value),
    partyRoute: (ids: string[]): RouteLocationRaw => partyLocation(tableScope.value, ids),
  }
}
