import { computed, watch } from 'vue'
import { useTable } from '@/composables/useTable'
import { useMediaStore } from '@/stores/media'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { connection } from '@/transport/connection'
import { closeMedia, openMedia } from '@/transport/media'
import { mode } from '@/transport/mode'
import { createLogger } from '@/utils/logger'

const log = createLogger('media-session')

/** Try again after a load the server refused; with the connection itself in trouble the session reopens on its own. */
export function retryMedia() {
  const id = useMediaStore().gameId
  if (!id || connection.value !== 'ok') return
  openMedia(id).catch((err: unknown) => log.warn('retry failed', { err }))
}

/**
 * Call once, in `app.vue`. While the open table is a game I master and the server is reachable, the
 * scenes are open (loaded and live); otherwise they are closed. A player's client never opens them.
 */
export function useMediaSession() {
  const { gameId } = useTable()
  const target = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    if (!onlineDataReady.value || connection.value !== 'ok') return null
    return isGameMaster(id) ? id : null
  })
  watch(target, (id) => {
    if (!id) {
      closeMedia()
      return
    }
    openMedia(id).catch((err: unknown) => log.warn('open failed', { err }))
  }, { immediate: true })
}
