import { defineStore } from 'pinia'

export const useCreationStore = defineStore('creation', {
  state: () => ({
    draftId: null as string | null,
    step: 1 as 1 | 2 | 3,
  }),
  actions: {
    setDraft(id: string) {
      this.draftId = id
    },
    setStep(n: 1 | 2 | 3) {
      this.step = n
    },
    nextStep() {
      if (this.step < 3) this.step = (this.step + 1) as 1 | 2 | 3
    },
    prevStep() {
      if (this.step > 1) this.step = (this.step - 1) as 1 | 2 | 3
    },
    reset() {
      this.draftId = null
      this.step = 1
    },
  },
  persist: {
    key: 'wod.creation.v1',
  },
})
