import { ref, type Ref } from 'vue'

export type AppMode = 'online' | 'offline'

export const MODE_STORAGE_KEY = 'wod.mode.v1'

function readStoredMode(): AppMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'offline' ? 'offline' : 'online'
  } catch {
    return 'online'
  }
}

export const mode: Ref<AppMode> = ref(readStoredMode())

let session = 0

// Bumped on every switch, so async work started in one mode can tell it must not touch the stores
// of the next one (the mode alone can't: online → offline → online looks unchanged).
export function modeSession(): number {
  return session
}

export function setMode(next: AppMode): void {
  session += 1
  mode.value = next
  try {
    localStorage.setItem(MODE_STORAGE_KEY, next)
  } catch {
    // storage unavailable: the mode still applies for this session
  }
}
