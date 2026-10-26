import { signInErrorKey } from '@/transport/authHelpers'
import { reportNetworkProblem } from '@/transport/connection'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const log = createLogger('account')

/** The message for a failed profile action; a network failure also starts the server-down check. */
export function accountErrorText(err: unknown): string {
  const key = signInErrorKey(err, 'save', false)
  if (key === 'auth.errors.network') reportNetworkProblem()
  else log.warn('account action failed', { err })
  return t(key)
}
