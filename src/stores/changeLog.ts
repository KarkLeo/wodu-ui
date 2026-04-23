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
    addEntry(entry: ChangeEntry) {
      this.entries.unshift(entry)
      if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
    },
    addMany(entries: ChangeEntry[]) {
      if (!entries.length) return
      log.debug('addMany', { count: entries.length })
      for (const e of entries) this.addEntry(e)
    },
    clearAll() {
      this.entries = []
    },
  },
})
