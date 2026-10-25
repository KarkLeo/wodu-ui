import { useRouter } from 'vue-router'
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

const log = createLogger('account')

export function useAccount() {
  const router = useRouter()

  // transport/session.ts starts and stops the online session when the sign-in state changes.
  async function signIn(otpId: string, code: string): Promise<void> {
    await verifyCode(otpId, code)
  }

  async function rename(name: string): Promise<void> {
    await updateProfile({ name: name.trim() })
  }

  function setLanguage(next: Locale): void {
    setLocale(next)
    if (mode.value !== 'online' || !signedIn.value) return
    updateProfile({ language: next }).catch(err => log.warn('language not saved to profile', { err }))
  }

  async function signOut(): Promise<void> {
    clearSession()
    await router.push('/')
  }

  async function deleteAccount(): Promise<void> {
    await deleteOwnAccount()
    await signOut()
  }

  return { user: currentUser, signedIn, requestCode, signIn, rename, setLanguage, signOut, deleteAccount }
}
