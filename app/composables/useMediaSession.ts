import { computed, watch, type ComputedRef } from 'vue'
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

let sessionTarget: ComputedRef<string | null> | null = null

/**
 * Try again after a load the server refused, of any kind; with the connection itself in trouble the session reopens on
 * its own. A retry while a load of the same game runs shares that load.
 */
export function retryMedia() {
  // The session's own target, so a game I do not master (any more) is never opened.
  const id = sessionTarget?.value
  const media = useMediaStore()
  if (!id || ![media.scenes, media.sounds, media.images].some(slot => slot.status === 'failed')) return
  openMedia(id).catch((err: unknown) => log.warn('retry failed', { err }))
}

/**
 * Call once, in `app.vue`. While the open table is a game I master, its scenes, sounds and images are open (loaded
 * and live); otherwise they are closed. A player's client never opens them.
 *
 * The connection only gates opening: a blip (`checking`, `down`) neither aborts an upload under way nor drops a
 * list that is loaded, and the return of `ok` re-opens the same game in place, which also restores the
 * subscription a reload after an outage drops.
 */
export function useMediaSession() {
  const { gameId } = useTable()
  const target = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    if (!onlineDataReady.value) return null
    return isGameMaster(id) ? id : null
  })
  sessionTarget = target
  const open = (id: string) => openMedia(id).catch((err: unknown) => log.warn('open failed', { err }))
  watch(target, (id, previous) => {
    if (!id) {
      closeMedia()
      return
    }
    // Another game: the old one's uploads end now, even if the new one cannot be opened yet.
    if (previous && previous !== id) closeMedia()
    if (connection.value === 'ok') open(id)
  }, { immediate: true })
  watch(connection, (state) => {
    if (state === 'ok' && target.value) open(target.value)
  })
}
