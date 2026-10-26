<script setup lang="ts">
import AuthScreen from '../AuthScreen.vue'
import AuthField from '../AuthField.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

defineProps<{
  busy: boolean
  error: string | null
  /** The game an invite link points at, shown above the form. */
  inviteGameName?: string
}>()

const email = defineModel<string>('email', { required: true })

const emit = defineEmits<{
  submit: []
  playOffline: []
}>()
</script>

<template>
  <AuthScreen title="World of Dungeons" :subtitle="t('auth.tagline')" :card-title="t('auth.email.title')">
    <template v-if="inviteGameName" #banner>
      <aside class="es-invite" :aria-label="t('games.invite.eyebrow')">
        <span class="es-invite-eyebrow">{{ t('games.invite.eyebrow') }}</span>
        <span class="es-invite-name">{{ inviteGameName }}</span>
      </aside>
    </template>

    <form class="es-form" novalidate @submit.prevent="emit('submit')">
      <AuthField
        id="auth-email"
        v-model="email"
        type="email"
        :label="t('auth.email.label')"
        :placeholder="t('auth.email.placeholder')"
        :hint="t('auth.email.hint')"
        autocomplete="email"
      />
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <Button type="submit" variant="hero" size="lg" class="auth-wide" :disabled="busy">
        {{ t('auth.email.submit') }}
      </Button>
    </form>

    <template #footer>
      <div class="es-rule" aria-hidden="true" />
      <Button variant="ghost" size="lg" class="auth-wide" @click="emit('playOffline')">
        {{ t('auth.email.playOffline') }}
      </Button>
      <p class="es-offline-hint">{{ t('auth.email.offlineHint') }}</p>
    </template>
  </AuthScreen>
</template>

<style scoped>
.es-invite {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  margin-bottom: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-md);
  background: rgba(26, 21, 16, 0.9);
  box-shadow: var(--shadow-2);
}
.es-invite-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vtt-accent-deep);
}
.es-invite-name {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
  overflow-wrap: anywhere;
}
.es-form { display: flex; flex-direction: column; gap: var(--s-3); }
.es-rule {
  height: 1px;
  margin-bottom: var(--s-2);
  background: linear-gradient(90deg, transparent, rgba(140, 106, 58, 0.4), transparent);
}
.es-offline-hint {
  margin: 0;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  color: var(--vtt-text-muted);
}
</style>
