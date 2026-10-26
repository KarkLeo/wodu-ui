import { ref } from 'vue'
import { modeSession } from '@/transport/mode'
import { reportWriteFailure } from '@/transport/writeFailure'
import { createLogger } from '@/utils/logger'

const log = createLogger('games:action')

/**
 * Runs one game-table write (leave, remove, move, …) behind a busy flag. A failure gets the usual
 * write-failure toast; a network failure is left to the server-unavailable overlay.
 */
export function useGameAction() {
  const busy = ref(false)

  async function run(what: string, failedMessage: string, op: () => Promise<unknown>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    const session = modeSession()
    try {
      await op()
      return true
    } catch (err) {
      log.warn(`${what} failed`, { err })
      reportWriteFailure(err, failedMessage, session)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, run }
}
