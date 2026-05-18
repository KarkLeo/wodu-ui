import { onMounted, onBeforeUnmount, readonly, ref, computed } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
let listenersAttached = 0

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferred.value = e as BeforeInstallPromptEvent
}

function handleAppInstalled() {
  installed.value = true
  deferred.value = null
}

export function usePwaInstall() {
  onMounted(() => {
    if (listenersAttached === 0) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.addEventListener('appinstalled', handleAppInstalled)
    }
    listenersAttached++
  })

  onBeforeUnmount(() => {
    listenersAttached = Math.max(0, listenersAttached - 1)
    if (listenersAttached === 0) {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  })

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
