import { useRouter } from 'vue-router'
import { mode, setMode, type AppMode } from '@/transport/mode'
import { bootstrap, stopOnline } from '@/transport/bootstrap'
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

  async function switchMode(next: AppMode): Promise<void> {
    if (next === mode.value) return
    // Tear the current mode down before the stores are cleared: a live offline watcher would persist
    // the cleared lists, and a live online load could land in the other mode's stores.
    if (mode.value === 'online') stopOnline()
    else stopOfflineSession()
    setMode(next)
    useCharactersStore().clearAll()
    useRollHistoryStore().clearAll()
    useChangeLogStore().clearAll()
    await router.push('/')
    // A later switch may have run while the navigation was pending; it owns the stores now.
    if (mode.value !== next) return
    if (next === 'offline') startOfflineSession()
    else await bootstrap()
  }

  return { switchMode }
}
