<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AuthScreen from '../AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
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
const input = ref<HTMLInputElement | null>(null)

const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const expiresLeft = computed(() => props.sentAt + OTP_TTL_MS - now.value)
const resendLeft = computed(() => props.sentAt + RESEND_COOLDOWN_MS - now.value)
const cells = computed(() => Array.from({ length: OTP_LENGTH }, (_, i) => code.value[i] ?? ''))

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = sanitizeCode(el.value)
  el.value = clean
  code.value = clean
  if (clean.length === OTP_LENGTH && !props.busy) emit('submit', clean)
}

watch(() => props.error, (err) => {
  if (!err) return
  code.value = ''
  if (input.value) input.value.value = ''
  void nextTick(() => input.value?.focus())
})

watch(() => props.sentAt, () => {
  code.value = ''
  if (input.value) input.value.value = ''
})
</script>

<template>
  <AuthScreen :title="t('auth.code.heading')" :subtitle="t('auth.code.sentTo', { email })" :card-title="t('auth.code.title')">
    <template #back>
      <button type="button" class="cs-back" @click="emit('back')">{{ t('auth.code.back') }}</button>
    </template>

    <div class="cs-code">
      <input
        id="auth-code"
        ref="input"
        class="cs-input"
        :aria-label="t('auth.code.title')"
        inputmode="numeric"
        autocomplete="one-time-code"
        :disabled="busy"
        autofocus
        @input="onInput"
      >
      <div class="cs-cells" aria-hidden="true">
        <span
          v-for="(digit, i) in cells"
          :key="i"
          class="cs-cell"
          :class="{ 'is-current': i === code.length, 'is-gap': i === OTP_LENGTH / 2 - 1 }"
        >{{ digit }}</span>
      </div>
    </div>

    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <p v-else class="cs-hint">{{ t('auth.code.hint') }}</p>

    <div class="cs-row">
      <span class="cs-status">
        {{ expiresLeft > 0 ? t('auth.code.expiresIn', { time: clock(expiresLeft) }) : t('auth.code.expired') }}
      </span>
      <Button variant="ghost" size="sm" :disabled="resendLeft > 0 || busy" @click="emit('resend')">
        {{ resendLeft > 0 ? t('auth.code.resendIn', { time: clock(resendLeft) }) : t('auth.code.resend') }}
      </Button>
    </div>

    <template #footer>
      <p class="auth-note">{{ t('auth.code.spamHint') }}</p>
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

.cs-code { position: relative; }
.cs-input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  font-size: 16px;
  caret-color: transparent;
  border: none;
  background: transparent;
  cursor: text;
}
.cs-cells {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  pointer-events: none;
}
.cs-cell {
  min-height: 44px;
  padding: 6px 0 4px;
  text-align: center;
  font-family: var(--font-serif);
  font-size: 24px;
  color: var(--vtt-text-primary);
  border-bottom: 1px solid rgba(140, 106, 58, 0.3);
  transition: border-color var(--t-fast) var(--ease);
}
.cs-cell.is-gap { margin-right: 6px; }
.cs-input:focus + .cs-cells .cs-cell.is-current {
  border-bottom-color: var(--vtt-accent);
  box-shadow: 0 6px 10px -8px rgba(212, 168, 87, 0.6);
}

.cs-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}
.cs-row { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); margin-top: var(--s-1); }
.cs-status {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
</style>
