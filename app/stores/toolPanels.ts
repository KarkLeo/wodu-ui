import { defineStore } from 'pinia'
import type { ToolPanelKey } from '@/types/toolPanels'

type OwnKey = Exclude<ToolPanelKey, 'encounter'>

/** Which of the master's cards are open in the tray, per device and never stored. The encounter's lives in its own store. */
export const useToolPanelsStore = defineStore('toolPanels', {
  state: () => ({
    open: { scenes: false, sounds: false, images: false } as Record<OwnKey, boolean>,
  }),
  actions: {
    toggle(key: OwnKey) {
      this.open[key] = !this.open[key]
    },
    close(key: OwnKey) {
      this.open[key] = false
    },
    clearAll() {
      this.open = { scenes: false, sounds: false, images: false }
    },
  },
})
