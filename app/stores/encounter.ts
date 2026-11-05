import { defineStore } from 'pinia'
import { isStaleMonster } from '@/domain/encounter'
import type { EncounterHit, EncounterMonster, EncounterState } from '@/types/encounter'
import type { LibraryStatus } from './library'

/** The master's open encounter: one game at a time, loaded and kept live by `transport/encounter.ts`. */
export const useEncounterStore = defineStore('encounter', {
  state: () => ({
    gameId: '',
    status: 'idle' as LibraryStatus,
    state: null as EncounterState | null,
    monsters: [] as EncounterMonster[],
    hits: [] as EncounterHit[],
    panelOpen: false,
    selectedMonsterId: null as string | null,
    expanded: new Set<string>(),
  }),
  getters: {
    monsterById: (state) => (id: string) => state.monsters.find(m => m.id === id),
  },
  actions: {
    // Reloading the same game keeps its panel on screen; another game starts empty.
    startLoading(gameId: string) {
      if (this.gameId !== gameId) this.clearAll()
      this.gameId = gameId
      this.status = 'loading'
    },
    // A local copy newer than the server's survives a reload that overtook one of its writes.
    setAll(gameId: string, state: EncounterState, monsters: EncounterMonster[], hits: EncounterHit[]) {
      this.gameId = gameId
      this.state = state
      this.monsters = monsters.map((incoming) => {
        const local = this.monsters.find(m => m.id === incoming.id)
        return local && isStaleMonster(incoming, local) ? local : incoming
      })
      this.hits = hits
      this.status = 'ready'
      this.pruneSelection()
    },
    setFailed(gameId: string) {
      if (this.gameId === gameId) this.status = 'failed'
    },
    // For rows that come from the server: an echo of an earlier write must not roll the screen back.
    upsertMonster(monster: EncounterMonster) {
      const idx = this.monsters.findIndex(m => m.id === monster.id)
      if (idx === -1) this.monsters.push(monster)
      else if (!isStaleMonster(monster, this.monsters[idx]!)) this.monsters[idx] = monster
    },
    // For this device's own edits and rollbacks, which are never stale.
    putMonster(monster: EncounterMonster) {
      const idx = this.monsters.findIndex(m => m.id === monster.id)
      if (idx === -1) this.monsters.push(monster)
      else this.monsters[idx] = monster
    },
    removeMonster(id: string) {
      this.monsters = this.monsters.filter(m => m.id !== id)
      if (this.selectedMonsterId === id) this.selectedMonsterId = null
      this.expanded.delete(id)
    },
    upsertHit(hit: EncounterHit) {
      if (!this.hits.some(h => h.id === hit.id)) this.hits.push(hit)
    },
    setState(state: EncounterState) {
      this.state = state
    },
    clearGame(gameId: string) {
      if (this.gameId === gameId) this.clearAll()
    },
    clearAll() {
      this.gameId = ''
      this.status = 'idle'
      this.state = null
      this.monsters = []
      this.hits = []
      this.panelOpen = false
      this.selectedMonsterId = null
      this.expanded = new Set()
    },
    togglePanel() {
      this.panelOpen = !this.panelOpen
      if (!this.panelOpen) this.selectedMonsterId = null
    },
    selectMonster(id: string | null) {
      this.selectedMonsterId = id
    },
    pruneSelection() {
      const ids = new Set(this.monsters.map(m => m.id))
      if (this.selectedMonsterId && !ids.has(this.selectedMonsterId)) this.selectedMonsterId = null
      for (const id of this.expanded) if (!ids.has(id)) this.expanded.delete(id)
    },
  },
})
