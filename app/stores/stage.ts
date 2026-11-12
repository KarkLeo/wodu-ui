import { defineStore } from 'pinia'
import type { Stage } from '@/types/stage'
import { emptyStage } from '@/domain/stage'

/** How a game's current stage value reached this device: `live` (a realtime change or my own publish) or `load` (a snapshot or a reload). */
export type StageSource = 'live' | 'load'

export const useStageStore = defineStore('stage', {
  state: () => ({
    byGame: {} as Record<string, Stage>,
    received: {} as Record<string, { source: StageSource; at: number }>,
  }),
  getters: {
    // A game the master never published to has no row: it shows nothing.
    stageOf: (state) => (gameId: string): Stage => state.byGame[gameId] ?? emptyStage(gameId),
    arrivalOf: (state) => (gameId: string) => state.received[gameId],
  },
  actions: {
    set(stage: Stage, source: StageSource = 'live') {
      // Before the stage itself, so whoever reacts to the new value already finds where it came from.
      this.received[stage.id] = { source, at: new Date().getTime() }
      this.byGame[stage.id] = stage
    },
    remove(gameId: string) {
      delete this.byGame[gameId]
      delete this.received[gameId]
    },
    clearAll() {
      this.byGame = {}
      this.received = {}
    },
  },
})
