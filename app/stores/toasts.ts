import { defineStore } from 'pinia'

export type ToastKind = 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  text: string
  expiresAt: number
}

const DEFAULT_TTL_MS = 5000

export const useToastsStore = defineStore('toasts', {
  state: () => ({
    items: [] as Toast[],
  }),
  actions: {
    push(text: string, kind: ToastKind = 'info', ttlMs = DEFAULT_TTL_MS) {
      const id = crypto.randomUUID()
      const expiresAt = Date.now() + ttlMs
      this.items.push({ id, kind, text, expiresAt })
      // Not `this.dismiss(id)`: calling an action makes this store's pinia the active one, and a timer that
      // outlives its app (a story's) would hand that stale pinia to whatever runs next.
      window.setTimeout(() => { this.items = this.items.filter(t => t.id !== id) }, ttlMs)
    },
    dismiss(id: string) {
      this.items = this.items.filter(t => t.id !== id)
    },
    clearAll() {
      this.items = []
    },
  },
})
