import { defineStore } from 'pinia'
import type { LibraryItem, LibraryMonster } from '@/types/library'

export type LibraryStatus = 'idle' | 'loading' | 'ready' | 'failed'
export type LibraryKind = 'monsters' | 'items'

/** The open game's library, loaded on demand by the master's screens; it holds one game at a time. */
export const useLibraryStore = defineStore('library', {
  state: () => ({
    gameId: '',
    monsters: [] as LibraryMonster[],
    items: [] as LibraryItem[],
    status: { monsters: 'idle', items: 'idle' } as Record<LibraryKind, LibraryStatus>,
  }),
  getters: {
    monsterById: (state) => (id: string) => state.monsters.find(m => m.id === id),
    itemById: (state) => (id: string) => state.items.find(i => i.id === id),
  },
  actions: {
    // Reloading the same game keeps its list on screen; another game starts empty.
    startLoading(gameId: string, kind: LibraryKind) {
      if (this.gameId !== gameId) this.clearAll()
      this.gameId = gameId
      this.status[kind] = 'loading'
    },
    setMonsters(gameId: string, monsters: LibraryMonster[]) {
      this.gameId = gameId
      this.monsters = monsters
      this.status.monsters = 'ready'
    },
    setItems(gameId: string, items: LibraryItem[]) {
      this.gameId = gameId
      this.items = items
      this.status.items = 'ready'
    },
    setFailed(gameId: string, kind: LibraryKind) {
      if (this.gameId === gameId) this.status[kind] = 'failed'
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
    upsertItem(gameId: string, item: LibraryItem) {
      if (this.gameId !== gameId) return
      const idx = this.items.findIndex(i => i.id === item.id)
      if (idx === -1) this.items.push(item)
      else this.items[idx] = item
    },
    removeItem(id: string) {
      this.items = this.items.filter(i => i.id !== id)
    },
    clearGame(gameId: string) {
      if (this.gameId === gameId) this.clearAll()
    },
    clearAll() {
      this.gameId = ''
      this.monsters = []
      this.items = []
      this.status = { monsters: 'idle', items: 'idle' }
    },
  },
})
