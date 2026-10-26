<script setup lang="ts">
import { useRouter } from 'vue-router'
import AuthScreen from '@/features/sign-in/AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

const router = useRouter()

// The account area shows the sign-in screen first and keeps the address, so this lands on the games.
function signIn() {
  void router.push({ name: 'games' })
}

function playOffline() {
  void router.push({ name: 'offline' })
}
</script>

<template>
  <AuthScreen title="World of Dungeons" :subtitle="t('auth.tagline')">
    <Button variant="hero" size="lg" class="auth-wide" @click="signIn">{{ t('landing.signIn') }}</Button>

    <template #footer>
      <div class="lv-rule" aria-hidden="true" />
      <Button variant="ghost" size="lg" class="auth-wide" @click="playOffline">
        {{ t('auth.email.playOffline') }}
      </Button>
      <p class="lv-offline-hint">{{ t('auth.email.offlineHint') }}</p>
    </template>
  </AuthScreen>
</template>

<style scoped>
.lv-rule {
  height: 1px;
  margin-bottom: var(--s-2);
  background: linear-gradient(90deg, transparent, rgba(140, 106, 58, 0.4), transparent);
}
.lv-offline-hint {
  margin: 0;
  text-align: center;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11px;
  color: var(--vtt-text-muted);
}
</style>
