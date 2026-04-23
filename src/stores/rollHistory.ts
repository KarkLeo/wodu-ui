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
    addRecord(record: RollRecord) {
      log.debug('addRecord', {
        id: record.id,
        characterId: record.characterId,
        purpose: record.purpose.kind,
        total: record.total,
        sizeBefore: this.records.length,
      })
      this.records.unshift(record)
      if (this.records.length > MAX_RECORDS) this.records.length = MAX_RECORDS
    },
    clearAll() {
      const before = this.records.length
      this.records = []
      log.debug('clearAll', { removed: before })
    },
  },
  persist: {
    key: 'wod.rollHistory.v1',
  },
})
