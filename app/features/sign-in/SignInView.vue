<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmailStep from './steps/EmailStep.vue'
import CodeStep from './steps/CodeStep.vue'
import NameStep from './steps/NameStep.vue'
import { useAccount } from '@/composables/useAccount'
import {
  defaultDisplayName,
  isPlausibleEmail,
  normalizeEmail,
  OTP_TTL_MS,
  signInErrorKey,
  type SignInAction,
} from '@/transport/authHelpers'
import { reportNetworkProblem } from '@/transport/connection'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

defineProps<{
  gate: 'sign-in' | 'name'
  /** Set while an invite link is open: the name of the game it points at. */
  inviteGameName?: string
}>()

const log = createLogger('sign-in')
const { user, requestCode, signIn, rename } = useAccount()
const router = useRouter()

function playOffline() {
  void router.push({ name: 'offline' })
}

const step = ref<'email' | 'code'>('email')
const email = ref('')
const otpId = ref('')
const sentAt = ref(0)
const busy = ref(false)
const error = ref<string | null>(null)

const suggestedName = computed(() => defaultDisplayName(user.value?.email ?? ''))

async function run(action: SignInAction, work: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await work()
  } catch (err) {
    const key = signInErrorKey(err, action, Date.now() > sentAt.value + OTP_TTL_MS)
    // The overlay takes over if the server stays unreachable; the inline line covers a short blip.
    if (key === 'auth.errors.network') reportNetworkProblem()
    else if (key === 'auth.errors.generic') log.warn('sign-in step failed', { action, err })
    error.value = t(key)
  } finally {
    busy.value = false
  }
}

function sendCode() {
  const address = normalizeEmail(email.value)
  if (!isPlausibleEmail(address)) {
    error.value = t('auth.errors.invalidEmail')
    return
  }
  void run('request', async () => {
    otpId.value = await requestCode(address)
    email.value = address
    sentAt.value = Date.now()
    step.value = 'code'
  })
}

function resend() {
  void run('resend', async () => {
    otpId.value = await requestCode(email.value)
    sentAt.value = Date.now()
  })
}

function submitCode(code: string) {
  void run('verify', () => signIn(otpId.value, code))
}

function back() {
  error.value = null
  step.value = 'email'
}

function saveName(name: string) {
  void run('save', () => rename(name))
}
</script>

<template>
  <NameStep v-if="gate === 'name'" :suggested="suggestedName" :busy="busy" :error="error" @save="saveName" />
  <CodeStep
    v-else-if="step === 'code'"
    :email="email"
    :sent-at="sentAt"
    :busy="busy"
    :error="error"
    @submit="submitCode"
    @resend="resend"
    @back="back"
  />
  <EmailStep
    v-else
    v-model:email="email"
    :invite-game-name="inviteGameName"
    :busy="busy"
    :error="error"
    @submit="sendCode"
    @play-offline="playOffline"
  />
</template>
