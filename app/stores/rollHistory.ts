import { defineStore } from 'pinia'
import type { RollRecord } from '@/types/dice'
import { createLogger } from '@/utils/logger'
import { HISTORY_LIMIT } from '@/transport/limits'

const log = createLogger('store:roll-history')

export const useRollHistoryStore = defineStore('rollHistory', {
  state: () => ({
    records: [] as RollRecord[],
  }),
  actions: {
    addLocal(record: RollRecord) {
      if (this.records.some(r => r.id === record.id)) return
      this.records.unshift(record)
      if (this.records.length > HISTORY_LIMIT) this.records.length = HISTORY_LIMIT
    },
    removeLocal(id: string) {
      this.records = this.records.filter(r => r.id !== id)
    },
    setAll(records: RollRecord[]) {
      log.debug('setAll', { count: records.length })
      this.records = records.slice(0, HISTORY_LIMIT)
    },
    clearAll() {
      this.records = []
    },
  },
})
