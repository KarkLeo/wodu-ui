import { defineStore } from 'pinia'

export const useCreationStore = defineStore('creation', {
  state: () => ({
    draftId: null as string | null,
    step: 1,
  }),
  actions: {
    setDraft(id: string) {
      this.draftId = id
    },
    nextStep() {
      if (this.step < 4) this.step++
    },
    prevStep() {
      if (this.step > 1) this.step--
    },
    reset() {
      this.draftId = null
      this.step = 1
    },
  },
  persist: true,
})
