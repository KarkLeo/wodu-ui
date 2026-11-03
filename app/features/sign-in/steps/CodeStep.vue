<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AuthScreen from '../AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
import CodeField from '@/components/ui/CodeField.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { OTP_LENGTH, OTP_TTL_MS, RESEND_COOLDOWN_MS, sanitizeCode } from '@/transport/authHelpers'
import { t } from '@/locales'

const props = defineProps<{
  email: string
  sentAt: number
  busy: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [code: string]
  resend: []
  back: []
}>()

const code = ref('')
const field = ref<InstanceType<typeof CodeField> | null>(null)

const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const expiresLeft = computed(() => props.sentAt + OTP_TTL_MS - now.value)
const resendLeft = computed(() => props.sentAt + RESEND_COOLDOWN_MS - now.value)
function onComplete(value: string) {
  if (!props.busy) emit('submit', value)
}

watch(() => props.error, (err) => {
  if (!err) return
  code.value = ''
  void nextTick(() => field.value?.focus())
})

watch(() => props.sentAt, () => {
  code.value = ''
})
</script>

<template>
  <AuthScreen :title="t('auth.code.heading')" :subtitle="t('auth.code.sentTo', { email })" :card-title="t('auth.code.title')">
    <template #back>
      <button type="button" class="cs-back" @click="emit('back')">{{ t('auth.code.back') }}</button>
    </template>

    <CodeField
      id="auth-code"
      ref="field"
      v-model="code"
      :length="OTP_LENGTH"
      :group-size="OTP_LENGTH / 2"
      :label="t('auth.code.title')"
      :sanitize="sanitizeCode"
      :disabled="busy"
      autofocus
      @complete="onComplete"
    />

    <FormError v-if="error" role="alert">{{ error }}</FormError>
    <StateNote v-else inline align="start" size="xs">{{ t('auth.code.hint') }}</StateNote>

    <div class="cs-row">
      <span class="cs-status">
        {{ expiresLeft > 0 ? t('auth.code.expiresIn', { time: clock(expiresLeft) }) : t('auth.code.expired') }}
      </span>
      <Button variant="ghost" size="sm" :disabled="resendLeft > 0 || busy" @click="emit('resend')">
        {{ resendLeft > 0 ? t('auth.code.resendIn', { time: clock(resendLeft) }) : t('auth.code.resend') }}
      </Button>
    </div>

    <template #footer>
      <StateNote inline size="xs">{{ t('auth.code.spamHint') }}</StateNote>
    </template>
  </AuthScreen>
</template>

<style scoped>
.cs-back {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
}
.cs-back:hover { color: var(--vtt-accent-soft); }

.cs-row { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); margin-top: var(--s-1); }
.cs-status {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
</style>
