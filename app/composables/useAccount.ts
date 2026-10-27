import { useRoute, useRouter } from 'vue-router'
import { mode } from '@/transport/mode'
import {
  clearSession,
  currentUser,
  deleteOwnAccount,
  requestCode,
  signedIn,
  updateProfile,
  verifyCode,
} from '@/transport/auth'
import { setLocale, type Locale } from '@/locales'
import { createLogger } from '@/utils/logger'
import { modeForPath } from '@/utils/routeMode'

const log = createLogger('account')

export function useAccount() {
  const router = useRouter()
  const route = useRoute()

  // transport/session.ts starts and stops the online session when the sign-in state changes.
  async function signIn(otpId: string, code: string): Promise<void> {
    await verifyCode(otpId, code)
  }

  async function rename(name: string): Promise<void> {
    await updateProfile({ name: name.trim() })
  }

  // A signed-in player's choice goes to the profile, also from the landing, which belongs to no mode and
  // may run offline (opened cold); the offline table never reaches the server.
  function setLanguage(next: Locale): void {
    setLocale(next)
    const onLanding = modeForPath(route.path) === null
    if (!signedIn.value || (mode.value !== 'online' && !onLanding)) return
    updateProfile({ language: next }).catch(err => log.warn('language not saved to profile', { err }))
  }

  // Leave for the landing (never gated) first: ending the session on a cabinet page would show the
  // sign-in screen there until the navigation lands.
  async function signOut(): Promise<void> {
    try {
      await router.push('/')
    } finally {
      clearSession()
    }
  }

  async function deleteAccount(): Promise<void> {
    await deleteOwnAccount()
    await signOut()
  }

  return { user: currentUser, signedIn, requestCode, signIn, rename, setLanguage, signOut, deleteAccount }
}
