import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { RecordModel } from 'pocketbase'
import { pb } from '@/transport/pb'
import { currentLocale, setLocale, LOCALES, type Locale } from '@/locales'
import { BOOTSTRAP_TIMEOUT_MS, isNetworkError, withTimeout } from './connection'
import { isAuthRejected, isCreateSkippable, resolveLanguage } from './authHelpers'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:auth')

export interface UserRecord {
  id: string
  email: string
  name: string
  language: Locale | ''
  verified: boolean
}

function toUser(record: RecordModel | null): UserRecord | null {
  if (!record) return null
  const language = (LOCALES as readonly string[]).includes(record.language) ? record.language as Locale : ''
  return {
    id: record.id,
    email: String(record.email ?? ''),
    name: String(record.name ?? ''),
    language,
    verified: record.verified === true,
  }
}

export const currentUser: Ref<UserRecord | null> = ref(toUser(pb.authStore.record))

const tokenValid = ref(pb.authStore.isValid)

pb.authStore.onChange(() => {
  currentUser.value = toUser(pb.authStore.record)
  tokenValid.value = pb.authStore.isValid
})

export const signedIn: ComputedRef<boolean> = computed(
  () => tokenValid.value && currentUser.value?.verified === true,
)

const users = () => pb.collection('users')

// PocketBase requires a password on create even with password auth off; nobody ever learns this one.
function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
}

// Without a server hook a code is only sent to an existing user, so the client creates the account first.
export async function requestCode(email: string): Promise<string> {
  const password = randomPassword()
  try {
    await users().create({ email, password, passwordConfirm: password })
  } catch (err) {
    if (!isCreateSkippable(err)) throw err
  }
  const { otpId } = await users().requestOTP(email)
  return otpId
}

async function syncLanguage(): Promise<void> {
  const user = currentUser.value
  if (!user) return
  const { apply, writeBack } = resolveLanguage(user.language, currentLocale.value)
  setLocale(apply)
  if (writeBack) await updateProfile({ language: apply })
}

export async function verifyCode(otpId: string, code: string): Promise<void> {
  await users().authWithOTP(otpId, code)
  await syncLanguage().catch(err => log.warn('language sync failed', { err }))
}

export async function restoreSession(): Promise<'signed-in' | 'signed-out' | 'unreachable'> {
  if (!pb.authStore.isValid) {
    pb.authStore.clear()
    return 'signed-out'
  }
  try {
    await withTimeout(users().authRefresh(), BOOTSTRAP_TIMEOUT_MS)
  } catch (err) {
    if (isAuthRejected(err)) {
      pb.authStore.clear()
      return 'signed-out'
    }
    // Anything else (a 5xx, say) is the server's trouble, not a reason to sign the player out.
    if (!isNetworkError(err)) log.warn('session refresh failed', { err })
    return 'unreachable'
  }
  await syncLanguage().catch(err => log.warn('language sync failed', { err }))
  return 'signed-in'
}

export async function updateProfile(patch: { name?: string; language?: Locale }): Promise<void> {
  const user = currentUser.value
  if (!user) return
  // The SDK refreshes authStore.record when the signed-in record is updated.
  await users().update(user.id, patch)
}

export async function deleteOwnAccount(): Promise<void> {
  const user = currentUser.value
  if (!user) return
  await users().delete(user.id)
  pb.authStore.clear()
}

export function clearSession(): void {
  pb.authStore.clear()
}
