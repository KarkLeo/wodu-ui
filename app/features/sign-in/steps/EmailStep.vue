<script setup lang="ts">
import AuthScreen from '../AuthScreen.vue'
import AuthField from '../AuthField.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

defineProps<{
  busy: boolean
  error: string | null
}>()

const email = defineModel<string>('email', { required: true })

const emit = defineEmits<{
  submit: []
  playOffline: []
}>()
</script>

<template>
  <AuthScreen title="World of Dungeons" :subtitle="t('auth.tagline')" :card-title="t('auth.email.title')">
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
