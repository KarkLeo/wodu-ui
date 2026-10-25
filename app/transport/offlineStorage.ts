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

export function loadOffline(): void {
  const chars = readKey(OFFLINE_KEYS.characters, isCharacterShape)
  const rolls = readKey(OFFLINE_KEYS.rolls, isRollRecordShape)
  const changes = readKey(OFFLINE_KEYS.changes, isChangeEntryShape)

  useCharactersStore().setAll(chars.items)
  useRollHistoryStore().setAll(rolls.items)
  useChangeLogStore().setAll(changes.items)

  if (chars.corrupt || rolls.corrupt || changes.corrupt) {
    useToastsStore().push(t('offline.loadFailed'), 'error')
  }
}

export function startOfflinePersistence(): () => void {
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()
  let warned = false

  function write(key: string, value: unknown) {
    if (mode.value !== 'offline') return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      if (warned) return
      warned = true
      useToastsStore().push(t('offline.saveFailed'), 'error')
    }
  }

  const stops = [
    watch(() => characters.list, v => write(OFFLINE_KEYS.characters, v), { deep: true }),
    watch(() => rollHistory.records, v => write(OFFLINE_KEYS.rolls, v), { deep: true }),
    watch(() => changeLog.entries, v => write(OFFLINE_KEYS.changes, v), { deep: true }),
  ]
  return () => stops.forEach(stop => stop())
}
