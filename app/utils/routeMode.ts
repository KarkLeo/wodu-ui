import type { AppMode } from '@/transport/mode'

/** The offline table and everything under it. The router matches paths case-insensitively, so this does too. */
export function isOfflinePath(path: string): boolean {
  const p = path.toLowerCase()
  return p === '/offline' || p.startsWith('/offline/')
}

/**
 * The mode an address runs in: device storage under /offline, the account everywhere else.
 * The landing (`/`) asks for none and keeps whatever mode is running.
 */
export function modeForPath(path: string): AppMode | null {
  if (path === '' || path === '/') return null
  return isOfflinePath(path) ? 'offline' : 'online'
}

/** The mode the app starts in. Opened on the landing it starts offline, so it never reaches the server. */
export function initialMode(path: string): AppMode {
  return modeForPath(path) ?? 'offline'
}
