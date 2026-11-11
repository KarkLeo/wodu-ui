import { defineStore } from 'pinia'
import type { Stage } from '@/types/stage'
import { emptyStage } from '@/domain/stage'

export const useStageStore = defineStore('stage', {
  state: () => ({
    byGame: {} as Record<string, Stage>,
  }),
  getters: {
    // A game the master never published to has no row: it shows nothing.
    stageOf: (state) => (gameId: string): Stage => state.byGame[gameId] ?? emptyStage(gameId),
  },
  actions: {
    set(stage: Stage) {
      this.byGame[stage.id] = stage
    },
    remove(gameId: string) {
      delete this.byGame[gameId]
    },
    clearAll() {
      this.byGame = {}
    },
  },
})
