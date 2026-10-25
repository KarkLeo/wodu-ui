<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { NuxtPage } from '#components'
import '@/assets/fonts'
import DiceOverlay from '@/components/DiceOverlay.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import ToastHost from '@/components/ToastHost.vue'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import ServerDownOverlay from '@/components/ServerDownOverlay.vue'
import GameLayout from '@/components/layout/GameLayout.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import { mode } from '@/transport/mode'
import { attempt, connection, probing, retryNow } from '@/transport/connection'
import { useModeSwitch } from '@/composables/useModeSwitch'

// RouterView reused the view when only params changed (e.g. /party/a → /party/a,b); NuxtPage's
// default key includes the params and would remount it.
const pageKey = (route: RouteLocationNormalizedLoaded) => String(route.name)

const { switchMode } = useModeSwitch()

const serverDown = computed(() => mode.value === 'online' && connection.value === 'down')
// The loop resets the count when it starts and bumps it only when the first probe fires a second later.
const shownAttempt = computed(() => Math.max(1, attempt.value))

const browserOnline = ref(navigator.onLine)
function syncOnline() {
  browserOnline.value = navigator.onLine
}
onMounted(() => {
  window.addEventListener('online', syncOnline)
  window.addEventListener('offline', syncOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', syncOnline)
  window.removeEventListener('offline', syncOnline)
})
</script>

<template>
  <DiceOverlay />
  <ToastHost />
  <PwaUpdatePrompt />

  <ServerDownOverlay
    v-if="serverDown"
    :attempt="shownAttempt"
    :no-internet="!browserOnline"
    :probing="probing"
    @retry="retryNow"
    @play-offline="switchMode('offline')"
  />

  <GameLayout :inert="serverDown">
    <NuxtPage :page-key="pageKey" />

    <template #left>
      <PlayersPanel />
    </template>

    <template #right>
      <DiceDrawer />
    </template>
  </GameLayout>
</template>
