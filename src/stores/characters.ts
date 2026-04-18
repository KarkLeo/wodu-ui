import { defineStore } from 'pinia'
import type { Character } from '@/types/character'
import { isReadyToLevelUp } from '@/utils/derived'

const STORAGE_KEY = 'wod.characters.v1'

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
      this.list.push(character)
      return character
    },
    update(id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>) {
      const idx = this.list.findIndex(c => c.id === id)
      if (idx !== -1) this.list[idx] = { ...this.list[idx], ...patch }
    },
    remove(id: string) {
      this.list = this.list.filter(c => c.id !== id)
      if (this.activeId === id) this.activeId = null
    },
    setActive(id: string | null) {
      this.activeId = id
    },
  },
  persist: {
    key: STORAGE_KEY,
    afterHydrate(ctx) {
      ctx.store.$patch((state) => {
        state.list = state.list.map((c: Character) => ({
          ...c,
          inventory: c.inventory ?? [],
          skillIds: c.skillIds ?? [],
          abilityIds: c.abilityIds ?? [],
        }))
      })
    },
  },
})
