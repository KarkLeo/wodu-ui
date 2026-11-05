import { defineStore } from 'pinia'
import { isStaleMonster } from '@/domain/encounter'
import type { EncounterHit, EncounterMonster, EncounterState } from '@/types/encounter'
import type { LibraryStatus } from './library'

/** The master's open encounter: one game at a time, loaded and kept live by `transport/encounter.ts`. */
export const useEncounterStore = defineStore('encounter', {
  state: () => ({
    gameId: '',
    status: 'idle' as LibraryStatus,
    /** A reload of a loaded encounter failed: the list stays usable, with a notice and Try again. */
    refreshFailed: false,
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
    // Reloading the same game is a refresh in place, so what depends on `ready` (apply, the log's Damage filter,
    // an open popup) lives through every dropped connection; another game starts empty.
    startLoading(gameId: string) {
      if (this.gameId !== gameId) this.clearAll()
      this.gameId = gameId
      if (this.status !== 'ready') this.status = 'loading'
    },
    // A local copy newer than the server's survives a reload that overtook one of its writes.
    setAll(gameId: string, state: EncounterState, monsters: EncounterMonster[], hits: EncounterHit[]) {
      const sameGame = this.gameId === gameId
      this.gameId = gameId
      this.state = state
      this.monsters = monsters.map((incoming) => {
        const local = sameGame ? this.monsters.find(m => m.id === incoming.id) : undefined
        return local && isStaleMonster(incoming, local) ? local : incoming
      })
      // Hits are append-only: one recorded here whose write has not landed yet must outlive a reload.
      const loaded = new Set(hits.map(h => h.id))
      this.hits = [...hits, ...(sameGame ? this.hits : []).filter(h => !loaded.has(h.id))]
      this.status = 'ready'
      this.refreshFailed = false
      this.pruneSelection()
    },
    setFailed(gameId: string) {
      if (this.gameId !== gameId) return
      if (this.status === 'ready') this.refreshFailed = true
      else this.status = 'failed'
    },
    // For rows that come from the server: an echo of an earlier write must not roll the screen back.
    upsertMonster(monster: EncounterMonster) {
      const idx = this.monsters.findIndex(m => m.id === monster.id)
      if (idx === -1) this.monsters.push(monster)
      else if (!isStaleMonster(monster, this.monsters[idx]!)) this.monsters[idx] = monster
      this.pruneSelection()
    },
    // For this device's own edits and rollbacks, which are never stale.
    putMonster(monster: EncounterMonster) {
      const idx = this.monsters.findIndex(m => m.id === monster.id)
      if (idx === -1) this.monsters.push(monster)
      else this.monsters[idx] = monster
      this.pruneSelection()
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
      this.refreshFailed = false
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
    // A selected monster that is gone or dead stops being selected, on whichever device it happened, so a revive never reselects it.
    pruneSelection() {
      const ids = new Set(this.monsters.map(m => m.id))
      if (this.selectedMonsterId) {
        const selected = this.monsters.find(m => m.id === this.selectedMonsterId)
        if (!selected || selected.diedAt !== undefined) this.selectedMonsterId = null
      }
      for (const id of this.expanded) if (!ids.has(id)) this.expanded.delete(id)
    },
  },
})
