import { defineStore } from 'pinia'
import type { ChangeEntry } from '@/types/changeLog'
import { createLogger } from '@/utils/logger'

const log = createLogger('store:change-log')
const MAX_ENTRIES = 200

export const useChangeLogStore = defineStore('changeLog', {
  state: () => ({
    entries: [] as ChangeEntry[],
  }),
  actions: {
    addLocal(entry: ChangeEntry) {
      if (this.entries.some(e => e.id === entry.id)) return
      this.entries.unshift(entry)
      if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
    },
    setAll(entries: ChangeEntry[]) {
      log.debug('setAll', { count: entries.length })
      this.entries = entries.slice(0, MAX_ENTRIES)
    },
    clearAll() {
      this.entries = []
    },
  },
})
