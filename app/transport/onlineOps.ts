import { currentUser } from './auth'
import { guard } from './backend'
import { BOOTSTRAP_TIMEOUT_MS, withTimeout } from './connection'
import { mode, modeSession } from './mode'

// A hanging server must not leave a button spinning: a timeout counts as a network failure.
export function call<T>(op: () => Promise<T>): Promise<T> {
  return guard(() => withTimeout(op(), BOOTSTRAP_TIMEOUT_MS))
}

/** The signed-in user's id; throws outside a signed-in online session. */
export function requireOnlineUser(): string {
  const id = currentUser.value?.id
  if (mode.value !== 'online' || !id) throw new Error('needs a signed-in online session')
  return id
}

// Work that finishes after a mode switch or a sign-out must not touch the stores of the next session.
export function staysCurrent(): () => boolean {
  const session = modeSession()
  const user = currentUser.value?.id ?? null
  return () => modeSession() === session && (currentUser.value?.id ?? null) === user
}
