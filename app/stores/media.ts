import { defineStore } from 'pinia'
import type { MediaEntries, MediaKind } from '@/types/stage'
import type { LibraryStatus } from './library'
import { useToolPanelsStore } from './toolPanels'

export interface Slot<T> {
  status: LibraryStatus
  list: T[]
}

const KINDS: readonly MediaKind[] = ['scenes', 'sounds', 'images']

const empty = (): Slot<never> => ({ status: 'idle', list: [] })

/** The master's scenes, sounds and images for the open game: one game at a time, loaded and kept live by `transport/media.ts`. */
export const useMediaStore = defineStore('media', {
  state: () => ({
    gameId: null as string | null,
    scenes: empty() as Slot<MediaEntries['scenes']>,
    sounds: empty() as Slot<MediaEntries['sounds']>,
    images: empty() as Slot<MediaEntries['images']>,
  }),
  actions: {
    // Reloading the same game keeps its lists on screen; another game starts empty.
    startLoading(gameId: string, kinds: readonly MediaKind[]) {
      // Another game's table opens: its cards start closed, as the encounter panel does.
      if (this.gameId !== gameId) {
        this.clearAll()
        useToolPanelsStore().clearAll()
      }
      this.gameId = gameId
      // A kind nobody loads yet stays idle.
      for (const kind of kinds) {
        if (this[kind].status !== 'ready') this[kind].status = 'loading'
      }
    },
    setList<K extends MediaKind>(kind: K, gameId: string, list: MediaEntries[K][]) {
      if (this.gameId !== gameId) return
      const slot = this[kind] as Slot<MediaEntries[K]>
      slot.list = list
      slot.status = 'ready'
    },
    setFailed(kind: MediaKind, gameId: string) {
      if (this.gameId !== gameId) return
      if (this[kind].status !== 'ready') this[kind].status = 'failed'
    },
    // A late answer for a game that is no longer the open one must not touch the list.
    put<K extends MediaKind>(kind: K, gameId: string, entry: MediaEntries[K]) {
      if (this.gameId !== gameId) return
      const list = this[kind].list as MediaEntries[K][]
      const idx = list.findIndex(e => e.id === entry.id)
      if (idx === -1) list.push(entry)
      else list[idx] = entry
    },
    remove(kind: MediaKind, gameId: string, id: string) {
      if (this.gameId !== gameId) return
      const slot: Slot<{ id: string }> = this[kind]
      slot.list = slot.list.filter(e => e.id !== id)
    },
    clearGame(gameId: string) {
      if (this.gameId === gameId) this.clearAll()
    },
    clearAll() {
      this.gameId = null
      for (const kind of KINDS) this[kind] = empty()
    },
  },
})
