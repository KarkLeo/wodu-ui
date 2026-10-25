<script setup lang="ts">
import { computed, ref } from 'vue'
import EmailStep from './steps/EmailStep.vue'
import CodeStep from './steps/CodeStep.vue'
import NameStep from './steps/NameStep.vue'
import { useAccount } from '@/composables/useAccount'
import { defaultDisplayName, isPlausibleEmail, normalizeEmail } from '@/transport/authHelpers'
import { isNetworkError, reportNetworkProblem } from '@/transport/connection'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

defineProps<{ gate: 'sign-in' | 'name' }>()

const emit = defineEmits<{ playOffline: [] }>()

const log = createLogger('sign-in')
const { user, requestCode, signIn, rename } = useAccount()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const otpId = ref('')
const sentAt = ref(0)
const busy = ref(false)
const error = ref<string | null>(null)

const suggestedName = computed(() => defaultDisplayName(user.value?.email ?? ''))

function messageFor(err: unknown): string | null {
  if (isNetworkError(err)) {
    // The server-unavailable overlay explains it; an inline error on top would repeat it.
    reportNetworkProblem()
    return null
  }
  const status = (err as { status?: number }).status
  if (status === 429) return t('auth.errors.tooMany')
  if (status === 400 && step.value === 'code') return t('auth.errors.wrongCode')
  log.warn('sign-in step failed', { err })
  return t('auth.errors.generic')
}

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = null
  try {
    await action()
  } catch (err) {
    error.value = messageFor(err)
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
  void run(async () => {
    otpId.value = await requestCode(address)
    email.value = address
    sentAt.value = Date.now()
    step.value = 'code'
  })
}

function resend() {
  void run(async () => {
    otpId.value = await requestCode(email.value)
    sentAt.value = Date.now()
  })
}

function submitCode(code: string) {
  void run(() => signIn(otpId.value, code))
}

function back() {
  error.value = null
  step.value = 'email'
}

function saveName(name: string) {
  void run(() => rename(name))
}
</script>

<template>
  <NameStep v-if="gate === 'name'" :suggested="suggestedName" :busy="busy" @save="saveName" />
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
    :busy="busy"
    :error="error"
    @submit="sendCode"
    @play-offline="emit('playOffline')"
  />
</template>
