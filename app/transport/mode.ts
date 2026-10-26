import { ref, type Ref } from 'vue'

export type AppMode = 'online' | 'offline'

// Follows the address (utils/routeMode.ts): set by the bootstrap plugin for the first URL, then by the
// mode route middleware on every navigation between the areas.
export const mode: Ref<AppMode> = ref('online')

let session = 0

// Bumped on every switch, so async work started in one mode can tell it must not touch the stores
// of the next one (the mode alone can't: online → offline → online looks unchanged).
export function modeSession(): number {
  return session
}

export function setMode(next: AppMode): void {
  session += 1
  mode.value = next
}
