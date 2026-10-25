import { watch } from 'vue'
import { mode } from './mode'
import { isCharacterShape, isRollRecordShape, isChangeEntryShape } from './shapes'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { useToastsStore } from '@/stores/toasts'
import { t } from '@/locales'

export const OFFLINE_KEYS = {
  characters: 'wod.offline.characters.v1',
  rolls: 'wod.offline.rolls.v1',
  changes: 'wod.offline.changes.v1',
} as const

export function parseList<T>(
  raw: string | null,
  isValid: (x: unknown) => x is T,
): { items: T[]; corrupt: boolean } {
  if (raw === null) return { items: [], corrupt: false }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { items: [], corrupt: true }
    return { items: parsed.filter(isValid), corrupt: false }
  } catch {
    return { items: [], corrupt: true }
  }
}

function readKey<T>(key: string, isValid: (x: unknown) => x is T): { items: T[]; corrupt: boolean } {
  try {
    return parseList(localStorage.getItem(key), isValid)
  } catch {
    return { items: [], corrupt: true }
  }
}

let hydrated = false

function readOfflineLists() {
  return {
    chars: readKey(OFFLINE_KEYS.characters, isCharacterShape),
    rolls: readKey(OFFLINE_KEYS.rolls, isRollRecordShape),
    changes: readKey(OFFLINE_KEYS.changes, isChangeEntryShape),
  }
}

export function loadOffline(): void {
  const { chars, rolls, changes } = readOfflineLists()

  useCharactersStore().setAll(chars.items)
  useRollHistoryStore().setAll(rolls.items)
  useChangeLogStore().setAll(changes.items)
  hydrated = true

  if (chars.corrupt || rolls.corrupt || changes.corrupt) {
    useToastsStore().push(t('offline.loadFailed'), 'error')
  }
}

const OFFLINE_KEY_SET: ReadonlySet<string> = new Set(Object.values(OFFLINE_KEYS))

export function startOfflinePersistence(): () => void {
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()
  let warned = false
  // What this tab last wrote or read back per key. A write that would only repeat it is skipped, so lists
  // reloaded after another tab's change are not written straight back (and do not bounce between tabs).
  const known = new Map<string, string>()

  function write(key: string, value: unknown) {
    if (mode.value !== 'offline' || !hydrated) return
    const json = JSON.stringify(value)
    if (known.get(key) === json) return
    try {
      localStorage.setItem(key, json)
      known.set(key, json)
    } catch {
      if (warned) return
      warned = true
      useToastsStore().push(t('offline.saveFailed'), 'error')
    }
  }

  // Another offline tab changed the lists: take its version instead of overwriting it on the next write.
  function onStorage(e: StorageEvent) {
    if (mode.value !== 'offline' || !hydrated) return
    if (e.key !== null && !OFFLINE_KEY_SET.has(e.key)) return
    const { chars, rolls, changes } = readOfflineLists()
    characters.setAll(chars.items)
    rollHistory.setAll(rolls.items)
    changeLog.setAll(changes.items)
    known.set(OFFLINE_KEYS.characters, JSON.stringify(characters.list))
    known.set(OFFLINE_KEYS.rolls, JSON.stringify(rollHistory.records))
    known.set(OFFLINE_KEYS.changes, JSON.stringify(changeLog.entries))
  }

  const stops = [
    watch(() => characters.list, v => write(OFFLINE_KEYS.characters, v), { deep: true }),
    watch(() => rollHistory.records, v => write(OFFLINE_KEYS.rolls, v), { deep: true }),
    watch(() => changeLog.entries, v => write(OFFLINE_KEYS.changes, v), { deep: true }),
  ]
  window.addEventListener('storage', onStorage)
  return () => {
    hydrated = false
    window.removeEventListener('storage', onStorage)
    stops.forEach(stop => stop())
  }
}
