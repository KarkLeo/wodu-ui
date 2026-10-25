import { watch, type WatchStopHandle } from 'vue'
import { mode } from './mode'
import { signedIn } from './auth'
import { sessionTransition } from './authHelpers'
import { bootstrap, stopOnline } from './bootstrap'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'

export function stopOnlineSession(): void {
  stopOnline()
  useCharactersStore().clearAll()
  useRollHistoryStore().clearAll()
  useChangeLogStore().clearAll()
}

let stopWatching: WatchStopHandle | null = null

// The single place that reacts to sign-in and sign-out, whether it happened in this tab or another one.
export function watchSession(): void {
  stopWatching?.()
  stopWatching = watch(signedIn, (now, was) => {
    const transition = sessionTransition(was, now, mode.value)
    if (transition === 'start') void bootstrap()
    else if (transition === 'stop') stopOnlineSession()
  })
}
