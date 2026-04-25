import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'
import { applyCommand } from '@/domain/reducer'
import type { CharacterCommand } from '@/domain/commands'
import { useChangeLogStore } from '@/stores/changeLog'
import { useRollHistoryStore } from '@/stores/rollHistory'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'

const STORAGE_KEY = 'wod.characters.v1'
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
    add(data: Omit<Character, 'id' | 'createdAt'>): Character {
      const character: Character = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      log.debug('add', { id: character.id, status: character.status, name: character.name, classId: character.classId })
      this.list.push(character)
      return character
    },
    update(id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>) {
      const idx = this.list.findIndex(c => c.id === id)
      if (idx === -1) {
        log.warn('update: not found', { id })
        return
      }
      log.debug('update', { id, keys: Object.keys(patch) })
      this.list[idx] = { ...this.list[idx], ...patch }
    },
    dispatch(id: string, cmd: CharacterCommand) {
      const idx = this.list.findIndex(c => c.id === id)
      if (idx === -1) {
        log.warn('dispatch: not found', { id, cmd: cmd.type })
        return
      }
      log.debug('dispatch', { id, cmd: cmd.type })
      const { character, changes } = applyCommand(this.list[idx], cmd)
      this.list[idx] = character
      if (character.status === 'active' && changes.length) {
        const now = Date.now()
        const entries: ChangeEntry[] = changes.map((c, i) => ({
          ...c,
          id: crypto.randomUUID(),
          timestamp: now + i,
          characterId: character.id,
          characterName: character.name,
        }))
        useChangeLogStore().addMany(entries)
      }
    },
    remove(id: string) {
      log.debug('remove', { id })
      this.list = this.list.filter(c => c.id !== id)
      if (this.activeId === id) this.activeId = null
      useRollHistoryStore().removeByCharacter(id)
      useChangeLogStore().removeByCharacter(id)
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
  },
  persist: {
    key: STORAGE_KEY,
    afterHydrate(ctx) {
      ctx.store.$patch((state) => {
        state.list = state.list.map((c: any) => {
          const { armor: _armor, ...rest } = c
          const magic = rest.magic
            ? {
                ...rest.magic,
                rituals: (rest.magic.rituals ?? []).map((r: any) =>
                  typeof r === 'string' ? { name: r, description: '' } : r,
                ),
              }
            : rest.magic
          return {
            ...rest,
            magic,
            inventory: rest.inventory ?? [],
            skillIds: rest.skillIds ?? [],
            abilityIds: rest.abilityIds ?? [],
          }
        })
      })
    },
  },
})
