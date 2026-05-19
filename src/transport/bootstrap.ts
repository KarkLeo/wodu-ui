import { ref, type Ref } from 'vue'
import { pb, type CharacterRow, type RollRow, type ChangeRow } from './pb'
import { HISTORY_LIMIT } from './limits'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { createLogger } from '@/utils/logger'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

const log = createLogger('transport:pb')
const sseLog = createLogger('transport:sse')

const COLLECTIONS = ['characters', 'roll_events', 'change_events'] as const

export type BootstrapStatus = 'loading' | 'ready' | 'failed'
export const bootstrapStatus: Ref<BootstrapStatus> = ref('loading')

const playedLocally = new Set<string>()

export function markRollPlayedLocally(id: string) {
  playedLocally.add(id)
}

function isCharacterShape(c: unknown): c is Character {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.inventory) &&
    typeof o.maxHp === 'number' &&
    !!o.stats &&
    typeof o.stats === 'object'
  )
}

function isRollRecordShape(r: unknown): r is RollRecord {
  if (!r || typeof r !== 'object') return false
  const o = r as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.notation === 'string' &&
    Array.isArray(o.dice) &&
    typeof o.total === 'number'
  )
}

function isChangeEntryShape(e: unknown): e is ChangeEntry {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.characterId === 'string' &&
    !!o.payload &&
    typeof o.payload === 'object'
  )
}

async function loadInitialState() {
  log.info('loadInitialState: starting')
  const [chars, rolls, changes] = await Promise.all([
    pb.collection('characters').getFullList<CharacterRow>(),
    pb.collection('roll_events').getList<RollRow>(1, HISTORY_LIMIT, { sort: '-created' }),
    pb.collection('change_events').getList<ChangeRow>(1, HISTORY_LIMIT, { sort: '-created' }),
  ])

  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  const validCharRows = chars.filter(r => isCharacterShape(r.data))
  const validRolls = rolls.items.map(r => r.data).filter(isRollRecordShape)
  const validChanges = changes.items.map(r => r.data).filter(isChangeEntryShape)

  const droppedChars = chars.length - validCharRows.length
  const droppedRolls = rolls.items.length - validRolls.length
  const droppedChanges = changes.items.length - validChanges.length
  if (droppedChars || droppedRolls || droppedChanges) {
    log.warn('loadInitialState: dropped malformed records', {
      chars: droppedChars,
      rolls: droppedRolls,
      changes: droppedChanges,
    })
  }

  characters.setAll(
    validCharRows.map(r => r.data),
    validCharRows.map(r => ({ id: r.id, updated: r.updated })),
  )
  rollHistory.setAll(validRolls)
  changeLog.setAll(validChanges)

  log.info('loadInitialState: done', {
    characters: validCharRows.length,
    rolls: validRolls.length,
    changes: validChanges.length,
  })
}

function subscribeAll() {
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  pb.collection('characters').subscribe<CharacterRow>('*', (e) => {
    sseLog.debug('characters', { action: e.action, id: e.record.id })
    if (e.action === 'create' || e.action === 'update') {
      if (!isCharacterShape(e.record.data)) {
        sseLog.warn('characters: malformed payload, ignoring', { id: e.record.id })
        return
      }
      characters.upsertLocal(e.record.data, e.record.updated)
    } else if (e.action === 'delete') {
      characters.removeLocal(e.record.id)
    }
  })

  pb.collection('roll_events').subscribe<RollRow>('*', (e) => {
    sseLog.debug('roll_events', { action: e.action, id: e.record.id })
    if (e.action === 'delete') {
      rollHistory.removeLocal(e.record.id)
      return
    }
    if (e.action !== 'create') return
    if (!isRollRecordShape(e.record.data)) {
      sseLog.warn('roll_events: malformed payload, ignoring', { id: e.record.id })
      return
    }
    const record = e.record.data
    rollHistory.addLocal(record)
    if (playedLocally.has(record.id)) {
      playedLocally.delete(record.id)
      return
    }
    const dice = record.discardedDice ? [...record.dice, ...record.discardedDice] : record.dice
    void enqueueDice(dice, record.notation)
  })

  pb.collection('change_events').subscribe<ChangeRow>('*', (e) => {
    sseLog.debug('change_events', { action: e.action, id: e.record.id })
    if (e.action === 'delete') {
      changeLog.removeLocal(e.record.id)
      return
    }
    if (e.action !== 'create') return
    if (!isChangeEntryShape(e.record.data)) {
      sseLog.warn('change_events: malformed payload, ignoring', { id: e.record.id })
      return
    }
    changeLog.addLocal(e.record.data)
  })

  log.info('SSE subscriptions registered', { collections: COLLECTIONS })
}

export async function bootstrap() {
  bootstrapStatus.value = 'loading'
  try {
    await loadInitialState()
    subscribeAll()
    bootstrapStatus.value = 'ready'
  } catch (err) {
    log.error('bootstrap failed — starting with empty store', { err })
    bootstrapStatus.value = 'failed'
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.info('HMR dispose: unsubscribing PB channels')
    for (const name of COLLECTIONS) {
      void pb.collection(name).unsubscribe()
    }
  })
}
