import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const log = createLogger('store:creation')

export const useCreationStore = defineStore('creation', {
  state: () => ({
    draftId: null as string | null,
    step: 1 as 1 | 2 | 3,
  }),
  actions: {
    setDraft(id: string) {
      log.debug('setDraft', { id })
      this.draftId = id
    },
    setStep(n: 1 | 2 | 3) {
      log.debug('setStep', { n })
      this.step = n
    },
    nextStep() {
      if (this.step < 3) {
        const next = (this.step + 1) as 1 | 2 | 3
        log.debug('nextStep', { from: this.step, to: next })
        this.step = next
      }
    },
    prevStep() {
      if (this.step > 1) {
        const next = (this.step - 1) as 1 | 2 | 3
        log.debug('prevStep', { from: this.step, to: next })
        this.step = next
      }
    },
    reset() {
      log.debug('reset', { prevDraftId: this.draftId, prevStep: this.step })
      this.draftId = null
      this.step = 1
    },
  },
  persist: {
    key: 'wod.creation.v1',
  },
})
