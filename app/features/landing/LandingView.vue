<script setup lang="ts">
import { useRouter } from 'vue-router'
import AuthScreen from '@/features/sign-in/AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { signedIn } from '@/transport/auth'
import { t } from '@/locales'

const router = useRouter()

// The cabinet opens on the games; signed out, it shows the sign-in screen there first and keeps the address.
function openCabinet() {
  void router.push({ name: 'games' })
}

function playOffline() {
  void router.push({ name: 'offline' })
}
</script>

<template>
  <AuthScreen title="World of Dungeons" :subtitle="t('auth.tagline')">
    <Button variant="hero" size="lg" class="auth-wide" @click="openCabinet">
      {{ signedIn ? t('landing.openCabinet') : t('landing.signIn') }}
    </Button>

    <template #footer>
      <div class="lv-rule" aria-hidden="true" />
      <Button variant="ghost" size="lg" class="auth-wide" @click="playOffline">
        {{ t('auth.email.playOffline') }}
      </Button>
      <StateNote inline size="xs">{{ t('auth.email.offlineHint') }}</StateNote>
    </template>
  </AuthScreen>
</template>

<style scoped>
.lv-rule {
  height: 1px;
  margin-bottom: var(--s-2);
  background: linear-gradient(90deg, transparent, var(--vtt-gold-a40), transparent);
}
</style>
