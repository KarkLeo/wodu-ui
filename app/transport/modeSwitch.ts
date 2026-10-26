import { mode, modeSession, setMode, type AppMode } from './mode'
import { bootstrap, stopOnline } from './bootstrap'
import { restoreSession } from './auth'
import { loadOffline, startOfflinePersistence } from './offlineStorage'
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

async function startOnlineSession(session: number): Promise<void> {
  // The token may have expired, or the account been deleted, while this device was offline.
  await restoreSession()
  if (modeSession() !== session) return
  await bootstrap()
}

/**
 * Switches the data source to `next`: stop the current mode, clear the three stores, load the other one.
 * Called by the mode route middleware before the target route's own guards run, so they already see the
 * new mode; offline data is there at once, online data arrives later (the guards wait for it).
 */
export function enterMode(next: AppMode): void {
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
  if (next === 'offline') startOfflineSession()
  else void startOnlineSession(session)
}
