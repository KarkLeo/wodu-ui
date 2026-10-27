import { readonly, ref, computed } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
let listening = false

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferred.value = e as BeforeInstallPromptEvent
}

function handleAppInstalled() {
  installed.value = true
  deferred.value = null
}

/**
 * The browser fires `beforeinstallprompt` once per page load, early, so the listeners go on at startup
 * (plugins/04.pwa-register.client.ts) and stay for the page's lifetime; a screen that offers installation
 * may mount long after the event.
 */
export function listenForInstallPrompt(): void {
  if (listening) return
  listening = true
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
}

export function usePwaInstall() {
  listenForInstallPrompt()

  async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
    const e = deferred.value
    if (!e) return null
    await e.prompt()
    const result = await e.userChoice
    deferred.value = null
    return result.outcome
  }

  return {
    canInstall: computed(() => deferred.value !== null),
    installed: readonly(installed),
    promptInstall,
  }
}
