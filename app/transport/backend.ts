import { pb } from '@/transport/pb'
import { mode } from './mode'
import { characterCreateBody, eventCreateBody } from './rows'
import { isNetworkError, reportNetworkProblem } from './connection'
import { useChangeLogStore } from '@/stores/changeLog'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

export interface Backend {
  createCharacter(c: Character): Promise<void>
  updateCharacter(c: Character): Promise<void>
  deleteCharacter(id: string): Promise<void>
  addChanges(entries: ChangeEntry[]): Promise<void>
  addRoll(r: RollRecord): Promise<void>
}

async function guarded(op: () => Promise<unknown>): Promise<void> {
  try {
    await op()
  } catch (err) {
    if (isNetworkError(err)) reportNetworkProblem()
    throw err
  }
}

export const pbBackend: Backend = {
  createCharacter: c =>
    guarded(async () => {
      const ownerId = pb.authStore.record?.id
      if (!ownerId) throw new Error('createCharacter: not signed in')
      await pb.collection('characters').create(characterCreateBody(c, ownerId))
    }),
  updateCharacter: c =>
    guarded(() => pb.collection('characters').update(c.id, { data: c })),
  deleteCharacter: id =>
    guarded(() => pb.collection('characters').delete(id)),
  addChanges: entries =>
    guarded(() => Promise.all(entries.map(entry =>
      pb.collection('change_events').create(eventCreateBody(entry)),
    ))),
  addRoll: r =>
    guarded(() => pb.collection('roll_events').create(eventCreateBody(r))),
}

export const localBackend: Backend = {
  createCharacter: () => Promise.resolve(),
  updateCharacter: () => Promise.resolve(),
  deleteCharacter: () => Promise.resolve(),
  addChanges: (entries) => {
    const log = useChangeLogStore()
    for (const entry of entries) log.addLocal(entry)
    return Promise.resolve()
  },
  addRoll: () => Promise.resolve(),
}

export function backend(): Backend {
  return mode.value === 'offline' ? localBackend : pbBackend
}
