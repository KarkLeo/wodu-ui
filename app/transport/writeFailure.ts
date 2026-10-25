import { isNetworkError, problemOutcome } from './connection'
import { modeSession } from './mode'
import { useToastsStore } from '@/stores/toasts'

/**
 * Tells the player that a write did not reach the server. A network failure waits for the grace period:
 * if it ends in the server-unavailable overlay, the overlay explains it; if the server turns out to be
 * reachable, the rolled-back change would otherwise go unnoticed, so the toast is shown then.
 * Nothing is shown once the mode has switched since the write started.
 */
export function reportWriteFailure(err: unknown, message: string, session: number): void {
  if (modeSession() !== session) return
  if (!isNetworkError(err)) {
    useToastsStore().push(message, 'error')
    return
  }
  void problemOutcome().then((outcome) => {
    if (outcome === 'ok' && modeSession() === session) useToastsStore().push(message, 'error')
  })
}
