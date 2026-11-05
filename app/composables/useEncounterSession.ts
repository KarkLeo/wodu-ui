import { computed, watch } from 'vue'
import { useTable } from '@/composables/useTable'
import { useEncounterStore } from '@/stores/encounter'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { connection } from '@/transport/connection'
import { closeEncounter, openEncounter } from '@/transport/encounter'
import { mode } from '@/transport/mode'
import { createLogger } from '@/utils/logger'

const log = createLogger('encounter-session')

/** The panel's Try again after a load the server refused; with the connection itself in trouble the session reopens on its own. */
export function retryEncounter() {
  const id = useEncounterStore().gameId
  if (!id || connection.value !== 'ok') return
  openEncounter(id).catch((err: unknown) => log.warn('retry failed', { err }))
}

/**
 * Call once, in `app.vue`. While the open table is a game I master and the server is reachable, the
 * encounter is open (loaded and live); otherwise it is closed. A return of `connection` to `ok`
 * reopens it, since a reload after an outage drops every realtime subscription.
 */
export function useEncounterSession() {
  const { gameId } = useTable()
  const target = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    if (!onlineDataReady.value || connection.value !== 'ok') return null
    return isGameMaster(id) ? id : null
  })
  watch(target, (id) => {
    if (!id) {
      closeEncounter()
      return
    }
    openEncounter(id).catch((err: unknown) => log.warn('open failed', { err }))
  }, { immediate: true })
}
