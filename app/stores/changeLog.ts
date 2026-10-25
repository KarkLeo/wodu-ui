import { defineStore } from 'pinia'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'
import { HISTORY_LIMIT } from '@/transport/limits'

const log = createLogger('store:change-log')

export const useChangeLogStore = defineStore('changeLog', {
  state: () => ({
    entries: [] as ChangeEntry[],
  }),
  actions: {
    addLocal(entry: ChangeEntry) {
      if (this.entries.some(e => e.id === entry.id)) return
      this.entries.unshift(entry)
      if (this.entries.length > HISTORY_LIMIT) this.entries.length = HISTORY_LIMIT
    },
    removeLocal(id: string) {
      this.entries = this.entries.filter(e => e.id !== id)
    },
    setAll(entries: ChangeEntry[]) {
      log.debug('setAll', { count: entries.length })
      this.entries = entries.slice(0, HISTORY_LIMIT)
    },
    clearAll() {
      this.entries = []
    },
  },
})
