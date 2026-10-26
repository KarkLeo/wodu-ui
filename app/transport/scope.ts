import { ref, type Ref } from 'vue'
import type { Scope } from '@/types/game'

// The table the player has open; the pages set it from the route. Online event loading follows it.
export const scope: Ref<Scope> = ref({ kind: 'home' })

function sameScope(a: Scope, b: Scope): boolean {
  if (a.kind !== b.kind) return false
  return a.kind !== 'game' || a.gameId === (b as { gameId: string }).gameId
}

export function setScope(next: Scope): void {
  if (sameScope(scope.value, next)) return
  scope.value = next
}
