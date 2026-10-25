import { fileURLToPath } from 'node:url'
import type { AliasOptions } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))

export const define = {
  // Frozen so that the build line renders the same across version bumps and runs.
  __APP_VERSION__: JSON.stringify('0.3.11'),
  __BUILD_TIMESTAMP__: JSON.stringify('2026-10-22T18:30:00.000Z'),
}

export const alias = [
  // Stories never talk to PocketBase; the mock must win over the generic '@' alias.
  { find: /^@\/transport\/pb$/, replacement: fileURLToPath(new URL('./mocks/pb.ts', import.meta.url)) },
  { find: /^@\//, replacement: `${root}app/` },
]

export function toAliasArray(a: AliasOptions | undefined) {
  if (!a) return []
  return Array.isArray(a) ? a : Object.entries(a).map(([find, replacement]) => ({ find, replacement }))
}
