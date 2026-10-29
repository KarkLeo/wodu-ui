import { defineStore } from 'pinia'
import type { LibraryMonster } from '@/types/library'

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** The open game's library, loaded on demand by the master's screens; it holds one game at a time. */
export const useLibraryStore = defineStore('library', {
  state: () => ({
    gameId: '',
    monsters: [] as LibraryMonster[],
    status: 'idle' as LibraryStatus,
  }),
  getters: {
    monsterById: (state) => (id: string) => state.monsters.find(m => m.id === id),
  },
  actions: {
    // Reloading the same game keeps its list on screen; another game starts empty.
    startLoading(gameId: string) {
      if (this.gameId !== gameId) this.monsters = []
      this.gameId = gameId
      this.status = 'loading'
    },
    setMonsters(gameId: string, monsters: LibraryMonster[]) {
      this.gameId = gameId
      this.monsters = monsters
      this.status = 'ready'
    },
    setFailed(gameId: string) {
      if (this.gameId === gameId) this.status = 'failed'
    },
    upsertMonster(gameId: string, monster: LibraryMonster) {
      if (this.gameId !== gameId) return
      const idx = this.monsters.findIndex(m => m.id === monster.id)
      if (idx === -1) this.monsters.push(monster)
      else this.monsters[idx] = monster
    },
    removeMonster(id: string) {
      this.monsters = this.monsters.filter(m => m.id !== id)
    },
    clearGame(gameId: string) {
      if (this.gameId === gameId) this.clearAll()
    },
    clearAll() {
      this.gameId = ''
      this.monsters = []
      this.status = 'idle'
    },
  },
})
