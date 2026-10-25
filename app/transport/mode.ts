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

export function setMode(next: AppMode): void {
  mode.value = next
  try {
    localStorage.setItem(MODE_STORAGE_KEY, next)
  } catch {
    // storage unavailable: the mode still applies for this session
  }
}
