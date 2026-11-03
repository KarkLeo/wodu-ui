<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AuthScreen from '../AuthScreen.vue'
import TextField from '@/components/ui/TextField.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import Button from '@/components/ui/Button.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
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
    <template #back>
      <RouterLink :to="{ name: 'landing' }" class="es-home">{{ t('auth.email.home') }}</RouterLink>
    </template>

    <template v-if="inviteGameName" #banner>
      <AlertBanner
        as="aside"
        tone="neutral"
        class="es-invite"
        :announce="false"
        :aria-label="t('games.invite.eyebrow')"
        :eyebrow="t('games.invite.eyebrow')"
        :title="inviteGameName"
      />
    </template>

    <form class="es-form" novalidate @submit.prevent="emit('submit')">
      <TextField
        v-model="email"
        variant="underline"
        type="email"
        :label="t('auth.email.label')"
        :placeholder="t('auth.email.placeholder')"
        :hint="t('auth.email.hint')"
        autocomplete="email"
        :spellcheck="false"
      />
      <FormError v-if="error" role="alert">{{ error }}</FormError>
      <Button type="submit" variant="hero" size="lg" class="auth-wide" :disabled="busy">
        {{ t('auth.email.submit') }}
      </Button>
    </form>

    <template #footer>
      <div class="es-rule" aria-hidden="true" />
      <Button variant="ghost" size="lg" class="auth-wide" @click="emit('playOffline')">
        {{ t('auth.email.playOffline') }}
      </Button>
      <StateNote inline size="xs">{{ t('auth.email.offlineHint') }}</StateNote>
    </template>
  </AuthScreen>
</template>

<style scoped>
.es-home {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--vtt-text-secondary);
}
.es-home:hover { color: var(--vtt-accent-soft); }
.es-home:focus-visible { outline: 1px solid var(--vtt-border-gold); outline-offset: 2px; }
/* Floats over the background image, like the card under it. */
.es-invite { margin-bottom: var(--s-3); box-shadow: var(--shadow-2); }
.es-form { display: flex; flex-direction: column; gap: var(--s-3); }
.es-rule {
  height: 1px;
  margin-bottom: var(--s-2);
  background: linear-gradient(90deg, transparent, rgba(140, 106, 58, 0.4), transparent);
}
</style>
