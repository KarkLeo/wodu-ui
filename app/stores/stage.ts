import { defineStore } from 'pinia'
import type { Stage } from '@/types/stage'
import { emptyStage, nextSoundArrival, type SlotArrival } from '@/domain/stage'

/** How a game's stage value reached this device: `live` (a realtime change or my own publish) or `load` (a snapshot or a reload). */
export type StageSource = SlotArrival['source']

export const useStageStore = defineStore('stage', {
  state: () => ({
    byGame: {} as Record<string, Stage>,
    // Per game, only for the sound slot (nothing reads the others): it moves only when the sound's key changes.
    soundArrival: {} as Record<string, SlotArrival>,
  }),
  getters: {
    // A game the master never published to has no row: it shows nothing.
    stageOf: (state) => (gameId: string): Stage => state.byGame[gameId] ?? emptyStage(gameId),
    soundArrivalOf: (state) => (gameId: string): SlotArrival | undefined => state.soundArrival[gameId],
  },
  actions: {
    set(stage: Stage, source: StageSource = 'live') {
      // Before the stage itself, so whoever reacts to the new value already finds where it came from.
      this.soundArrival[stage.id] = nextSoundArrival(this.byGame[stage.id], stage, this.soundArrival[stage.id], source, new Date().getTime())
      this.byGame[stage.id] = stage
    },
    remove(gameId: string) {
      delete this.byGame[gameId]
      delete this.soundArrival[gameId]
    },
    clearAll() {
      this.byGame = {}
      this.soundArrival = {}
    },
  },
})
