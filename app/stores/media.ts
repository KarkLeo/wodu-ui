import { defineStore } from 'pinia'
import type { Scene } from '@/types/stage'
import type { LibraryStatus } from './library'

/** The master's scenes for the open game: one game at a time, loaded and kept live by `transport/media.ts`. */
export const useMediaStore = defineStore('media', {
  state: () => ({
    gameId: null as string | null,
    scenes: { status: 'idle' as LibraryStatus, list: [] as Scene[] },
  }),
  actions: {
    // Reloading the same game keeps its list on screen; another game starts empty.
    startLoading(gameId: string) {
      if (this.gameId !== gameId) this.clearAll()
      this.gameId = gameId
      if (this.scenes.status !== 'ready') this.scenes.status = 'loading'
    },
    setScenes(gameId: string, list: Scene[]) {
      if (this.gameId !== gameId) return
      this.scenes.list = list
      this.scenes.status = 'ready'
    },
    setFailed(gameId: string) {
      if (this.gameId !== gameId) return
      if (this.scenes.status !== 'ready') this.scenes.status = 'failed'
    },
    // A late answer for a game that is no longer the open one must not touch the list.
    putScene(gameId: string, scene: Scene) {
      if (this.gameId !== gameId) return
      const idx = this.scenes.list.findIndex(s => s.id === scene.id)
      if (idx === -1) this.scenes.list.push(scene)
      else this.scenes.list[idx] = scene
    },
    removeScene(gameId: string, id: string) {
      if (this.gameId !== gameId) return
      this.scenes.list = this.scenes.list.filter(s => s.id !== id)
    },
    clearGame(gameId: string) {
      if (this.gameId === gameId) this.clearAll()
    },
    clearAll() {
      this.gameId = null
      this.scenes = { status: 'idle', list: [] }
    },
  },
})
