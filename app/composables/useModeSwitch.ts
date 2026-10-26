import { useRouter, type RouteLocationRaw } from 'vue-router'
import { mode, modeSession, setMode, type AppMode } from '@/transport/mode'
import { bootstrap, stopOnline } from '@/transport/bootstrap'
import { restoreSession } from '@/transport/auth'
import { loadOffline, startOfflinePersistence } from '@/transport/offlineStorage'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'

let stopPersistence: (() => void) | null = null

export function startOfflineSession(): void {
  stopPersistence?.()
  loadOffline()
  stopPersistence = startOfflinePersistence()
}

function stopOfflineSession(): void {
  stopPersistence?.()
  stopPersistence = null
}

export function useModeSwitch() {
  const router = useRouter()

  // `to` keeps a deep link across the switch, e.g. an invite opened in offline mode.
  async function switchMode(next: AppMode, to: RouteLocationRaw = '/'): Promise<void> {
    if (next === mode.value) return
    // Tear the current mode down before the stores are cleared: a live offline watcher would persist
    // the cleared lists, and a live online load could land in the other mode's stores.
    if (mode.value === 'online') stopOnline()
    else stopOfflineSession()
    setMode(next)
    const session = modeSession()
    useCharactersStore().clearAll()
    useRollHistoryStore().clearAll()
    useChangeLogStore().clearAll()
    await router.push(to)
    // A later switch may have run while the navigation was pending; it owns the stores now.
    if (modeSession() !== session) return
    if (next === 'offline') startOfflineSession()
    else {
      // The token may have expired, or the account been deleted, while this device was offline.
      await restoreSession()
      if (modeSession() !== session) return
      await bootstrap()
    }
  }

  return { switchMode }
}
