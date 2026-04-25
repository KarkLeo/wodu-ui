import { computed } from 'vue'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

export type LogItem =
  | { kind: 'roll'; id: string; timestamp: number; payload: RollRecord }
  | { kind: 'change'; id: string; timestamp: number; payload: ChangeEntry }

export type LogFilter = 'all' | 'rolls' | 'changes'

export function useUnifiedLog() {
  const rolls = useRollHistoryStore()
  const changes = useChangeLogStore()

  const items = computed<LogItem[]>(() => {
    const a: LogItem[] = rolls.records.map(r => ({ kind: 'roll', id: r.id, timestamp: r.timestamp, payload: r }))
    const b: LogItem[] = changes.entries.map(e => ({ kind: 'change', id: e.id, timestamp: e.timestamp, payload: e }))
    return [...a, ...b].sort((x, y) => y.timestamp - x.timestamp)
  })

  function filtered(filter: LogFilter): LogItem[] {
    if (filter === 'rolls') return items.value.filter(i => i.kind === 'roll')
    if (filter === 'changes') return items.value.filter(i => i.kind === 'change')
    return items.value
  }

  function clearAll() {
    rolls.clearAll()
    changes.clearAll()
  }

  return { items, filtered, clearAll, hasAny: computed(() => items.value.length > 0) }
}
