import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'
import { mode } from '@/transport/mode'

const log = createLogger('store:creation')

type Step = 1 | 2 | 3

interface DraftPointer {
  draftId: string | null
  step: Step
}

// One pointer per mode: an online draft id must never point into the offline list, and vice versa.
export const useCreationStore = defineStore('creation', {
  state: () => ({
    perMode: {
      online: { draftId: null, step: 1 } as DraftPointer,
      offline: { draftId: null, step: 1 } as DraftPointer,
    },
  }),
  getters: {
    draftId: (state): string | null => state.perMode[mode.value].draftId,
    step: (state): Step => state.perMode[mode.value].step,
  },
  actions: {
    setDraft(id: string) {
      log.debug('setDraft', { id, mode: mode.value })
      this.perMode[mode.value].draftId = id
    },
    setStep(n: Step) {
      log.debug('setStep', { n })
      this.perMode[mode.value].step = n
    },
    nextStep() {
      const cur = this.perMode[mode.value]
      if (cur.step < 3) {
        const next = (cur.step + 1) as Step
        log.debug('nextStep', { from: cur.step, to: next })
        cur.step = next
      }
    },
    prevStep() {
      const cur = this.perMode[mode.value]
      if (cur.step > 1) {
        const next = (cur.step - 1) as Step
        log.debug('prevStep', { from: cur.step, to: next })
        cur.step = next
      }
    },
    reset() {
      const cur = this.perMode[mode.value]
      log.debug('reset', { prevDraftId: cur.draftId, prevStep: cur.step, mode: mode.value })
      cur.draftId = null
      cur.step = 1
    },
  },
  persist: {
    key: 'wod.creation.v2',
  },
})
