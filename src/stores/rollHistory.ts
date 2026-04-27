import { defineStore } from 'pinia'
import type { RollRecord } from '@/types/dice'
import { createLogger } from '@/utils/logger'

const log = createLogger('store:roll-history')
const MAX_RECORDS = 200

export const useRollHistoryStore = defineStore('rollHistory', {
  state: () => ({
    records: [] as RollRecord[],
  }),
  actions: {
    addLocal(record: RollRecord) {
      if (this.records.some(r => r.id === record.id)) return
      this.records.unshift(record)
      if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS
    },
    setAll(records: RollRecord[]) {
      log.debug('setAll', { count: records.length })
      this.records = records.slice(0, MAX_RECORDS)
    },
    clearAll() {
      this.records = []
    },
  },
})
