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
import { bootstrap, stopOnline } from '@/transport/bootstrap'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { setLocale, type Locale } from '@/locales'
import { createLogger } from '@/utils/logger'

const log = createLogger('account')

export function useAccount() {
  const router = useRouter()

  async function signIn(otpId: string, code: string): Promise<void> {
    await verifyCode(otpId, code)
    // Not awaited: the name step can show while the table loads.
    void bootstrap()
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
    stopOnline()
    useCharactersStore().clearAll()
    useRollHistoryStore().clearAll()
    useChangeLogStore().clearAll()
    clearSession()
    await router.push('/')
  }

  async function deleteAccount(): Promise<void> {
    await deleteOwnAccount()
    await signOut()
  }

  return { user: currentUser, signedIn, requestCode, signIn, rename, setLanguage, signOut, deleteAccount }
}
