import { defineStore } from 'pinia'
import type { Character } from '@/types/character'

export const useCharactersStore = defineStore('characters', {
  state: () => ({
    list: [] as Character[],
  }),
  getters: {
    getById: (state) => (id: string) =>
      state.list.find((c) => c.id === id),
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
    update(id: string, patch: Partial<Character>) {
      const idx = this.list.findIndex((c) => c.id === id)
      if (idx !== -1) this.list[idx] = { ...this.list[idx], ...patch }
    },
    remove(id: string) {
      this.list = this.list.filter((c) => c.id !== id)
    },
  },
  persist: true,
})
