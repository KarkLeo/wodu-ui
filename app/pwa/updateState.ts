import { ref } from 'vue'

// Set when a new service worker is waiting; the page keeps the old one until the user applies it.
export const updateReady = ref(false)

let activate: () => Promise<void> = async () => {}

export function onApplyUpdate(fn: () => Promise<void>) {
  activate = fn
}

/** Lets the waiting worker take over; the page reloads once it controls the page. */
export function applyUpdate() {
  return activate()
}
