import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'
import { applyCommand } from '@/domain/reducer'
import type { CharacterCommand } from '@/domain/commands'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'
import { pb } from '@/transport/pb'

const log = createLogger('store:characters')

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
    activeId: null as string | null,
  }),
  getters: {
    active(state): Character | undefined {
      return state.activeId ? state.list.find(c => c.id === state.activeId) : undefined
    },
    getById: (state) => (id: string) => state.list.find(c => c.id === id),
    isReadyToLevelUp: () => (char: Character) => isReadyToLevelUp(char),
  },
  actions: {
    async add(data: Omit<Character, 'id' | 'createdAt'>): Promise<Character> {
      const character: Character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      log.debug('add', { id: character.id, status: character.status, name: character.name, classId: character.classId })
      await pb.collection('characters').create({ id: character.id, data: character })
      return character
    },
    async dispatch(id: string, cmd: CharacterCommand): Promise<void> {
      const char = this.list.find(c => c.id === id)
      if (!char) {
        log.warn('dispatch: not found', { id, cmd: cmd.type })
        return
      }
      log.debug('dispatch', { id, cmd: cmd.type })
      const { character: next, changes } = applyCommand(char, cmd)
      try {
        await pb.collection('characters').update(id, { data: next })
        if (next.status === 'active' && changes.length) {
          const now = Date.now()
          const entries: ChangeEntry[] = changes.map((c, i) => ({
            ...c,
            id: crypto.randomUUID(),
            timestamp: now + i,
            characterId: next.id,
            characterName: next.name,
          }))
          for (const entry of entries) {
            await pb.collection('change_events').create({
              id: entry.id,
              character_id: entry.characterId,
              data: entry,
            })
          }
        }
      } catch (err) {
        log.error('dispatch: PB failed', { id, cmd: cmd.type, err })
        throw err
      }
    },
    async remove(id: string): Promise<void> {
      log.debug('remove', { id })
      try {
        await pb.collection('characters').delete(id)
      } catch (err) {
        log.error('remove: PB failed', { id, err })
        throw err
      }
      if (this.activeId === id) this.activeId = null
    },
    setActive(id: string | null) {
      if (id && !this.list.some(c => c.id === id)) {
        log.warn('setActive: unknown id', { id })
        this.activeId = null
        return
      }
      log.debug('setActive', { prev: this.activeId, next: id })
      this.activeId = id
    },
    clearAll() {
      log.info('clearAll', { count: this.list.length })
      this.list = []
      this.activeId = null
    },
    setAll(chars: Character[]) {
      log.debug('setAll', { count: chars.length })
      this.list = chars
    },
    upsertLocal(char: Character) {
      const idx = this.list.findIndex(c => c.id === char.id)
      if (idx === -1) this.list.push(char)
      else this.list[idx] = char
    },
    removeLocal(id: string) {
      this.list = this.list.filter(c => c.id !== id)
      if (this.activeId === id) this.activeId = null
    },
  },
})
