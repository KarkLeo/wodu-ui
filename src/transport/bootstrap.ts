import { pb, type CharacterRow, type RollRow, type ChangeRow } from './pb'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { enqueueCoalesced as enqueueDice } from '@/services/DiceAnimationQueue'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:pb')
const sseLog = createLogger('transport:sse')

const COLLECTIONS = ['characters', 'roll_events', 'change_events'] as const

async function loadInitialState() {
  log.info('loadInitialState: starting')
  const [chars, rolls, changes] = await Promise.all([
    pb.collection('characters').getFullList<CharacterRow>(),
    pb.collection('roll_events').getList<RollRow>(1, 200, { sort: '-created' }),
    pb.collection('change_events').getList<ChangeRow>(1, 200, { sort: '-created' }),
  ])

  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  characters.setAll(chars.map(r => r.data))
  rollHistory.setAll(rolls.items.map(r => r.data))
  changeLog.setAll(changes.items.map(r => r.data))

  log.info('loadInitialState: done', {
    characters: chars.length,
    rolls: rolls.items.length,
    changes: changes.items.length,
  })
}

function subscribeAll() {
  const characters = useCharactersStore()
  const rollHistory = useRollHistoryStore()
  const changeLog = useChangeLogStore()

  pb.collection('characters').subscribe<CharacterRow>('*', (e) => {
    sseLog.debug('characters', { action: e.action, id: e.record.id })
    if (e.action === 'create' || e.action === 'update') {
      characters.upsertLocal(e.record.data)
    } else if (e.action === 'delete') {
      characters.removeLocal(e.record.id)
    }
  })

  pb.collection('roll_events').subscribe<RollRow>('*', (e) => {
    if (e.action !== 'create') return
    sseLog.debug('roll_events', { id: e.record.id, characterId: e.record.character_id })
    const record = e.record.data
    rollHistory.addLocal(record)
    void enqueueDice(record.dice, record.notation)
  })

  pb.collection('change_events').subscribe<ChangeRow>('*', (e) => {
    if (e.action !== 'create') return
    sseLog.debug('change_events', { id: e.record.id, characterId: e.record.character_id })
    changeLog.addLocal(e.record.data)
  })

  log.info('SSE subscriptions registered', { collections: COLLECTIONS })
}

export async function bootstrap() {
  try {
    await loadInitialState()
    subscribeAll()
  } catch (err) {
    log.error('bootstrap failed — starting with empty store', { err })
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
