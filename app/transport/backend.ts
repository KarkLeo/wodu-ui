import { pb } from '@/transport/pb'
import { mode } from './mode'
import { characterCreateBody, eventCreateBody } from './rows'
import { isNetworkError, reportNetworkProblem } from './connection'
import { useChangeLogStore } from '@/stores/changeLog'
import { useCharactersStore } from '@/stores/characters'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { ChangeEntry } from '@/types/changeLog'

export interface Backend {
  createCharacter(c: Character, game?: string): Promise<void>
  updateCharacter(c: Character): Promise<void>
  deleteCharacter(id: string): Promise<void>
  addChanges(entries: ChangeEntry[]): Promise<void>
  addRoll(r: RollRecord): Promise<void>
}

export async function guard<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (err) {
    if (isNetworkError(err)) reportNetworkProblem()
    throw err
  }
}

async function guarded(op: () => Promise<unknown>): Promise<void> {
  await guard(op)
}

// The server accepts an event only with the character's current game, which lives on its record.
function gameOf(characterId: string): string {
  return useCharactersStore().metaOf(characterId)?.game ?? ''
}

export const pbBackend: Backend = {
  createCharacter: (c, game = '') =>
    guarded(async () => {
      const ownerId = pb.authStore.record?.id
      if (!ownerId) throw new Error('createCharacter: not signed in')
      await pb.collection('characters').create(characterCreateBody(c, ownerId, game))
    }),
  updateCharacter: c =>
    guarded(() => pb.collection('characters').update(c.id, { data: c })),
  deleteCharacter: id =>
    guarded(() => pb.collection('characters').delete(id)),
  addChanges: entries =>
    guarded(() => Promise.all(entries.map(entry =>
      pb.collection('change_events').create(eventCreateBody(entry, gameOf(entry.characterId))),
    ))),
  addRoll: r =>
    guarded(() => pb.collection('roll_events').create(eventCreateBody(r, gameOf(r.characterId)))),
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
