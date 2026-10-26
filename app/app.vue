<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { NuxtPage } from '#components'
import { useRoute } from '#imports'
import '@/assets/fonts'
import DiceOverlay from '@/components/DiceOverlay.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import ToastHost from '@/components/ToastHost.vue'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import ServerDownOverlay from '@/components/ServerDownOverlay.vue'
import GameLayout from '@/components/layout/GameLayout.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import SignInView from '@/features/sign-in/SignInView.vue'
import { mode } from '@/transport/mode'
import { attempt, connection, probeNow, probing, reportNetworkProblem, retryNow } from '@/transport/connection'
import { useModeSwitch } from '@/composables/useModeSwitch'
import { currentUser, signedIn } from '@/transport/auth'
import { authGate } from '@/transport/authHelpers'
import { setScope } from '@/transport/scope'
import { findGameByCode } from '@/transport/games'
import { normalizeInviteCode } from '@/utils/inviteCode'
import { scopeForRoute } from '@/utils/scope'

// RouterView reused the view when only params changed (e.g. /party/a → /party/a,b); NuxtPage's
// default key includes the params and would remount it.
const pageKey = (route: RouteLocationNormalizedLoaded) => String(route.name)

const { switchMode } = useModeSwitch()

const gate = computed(() => authGate(mode.value, signedIn.value, currentUser.value?.name ?? ''))

const route = useRoute()

// The open table follows the route; online loading (events, the game's characters) follows the table.
watch(
  () => [route.name, route.params.gameId, mode.value] as const,
  ([name, gameId, m]) => setScope(scopeForRoute(String(name ?? ''), gameId as string | undefined, m === 'online')),
  { immediate: true },
)

// An invite link opened while signed out shows the game's name above the sign-in form.
const inviteGameName = ref<string | undefined>()
let inviteLookup = 0
watch(
  () => [gate.value, route.name, route.params.code] as const,
  async ([g, name, rawCode]) => {
    const lookup = ++inviteLookup
    inviteGameName.value = undefined
    if (g !== 'sign-in' || name !== 'join') return
    const code = normalizeInviteCode(String(rawCode ?? ''))
    if (!code) return
    try {
      const game = await findGameByCode(code)
      if (lookup === inviteLookup) inviteGameName.value = game?.name
    } catch {
      // No banner: the join page reports the problem after sign-in.
    }
  },
  { immediate: true },
)

const serverDown = computed(() => mode.value === 'online' && connection.value === 'down')
// The loop resets the count when it starts and bumps it only when the first probe fires a second later.
const shownAttempt = computed(() => Math.max(1, attempt.value))

const browserOnline = ref(navigator.onLine)
function syncOnline() {
  browserOnline.value = navigator.onLine
}
// An open realtime stream can outlive the network for minutes, so losing it would go unnoticed
// until the next write. reportNetworkProblem() ignores offline mode and applies the usual grace.
function onBrowserOffline() {
  syncOnline()
  reportNetworkProblem()
}
// Back online: check the server now rather than wait out the grace period or the reconnect backoff.
function onBrowserOnline() {
  syncOnline()
  probeNow()
}
onMounted(() => {
  window.addEventListener('online', onBrowserOnline)
  window.addEventListener('offline', onBrowserOffline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', onBrowserOnline)
  window.removeEventListener('offline', onBrowserOffline)
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

  <SignInView
    v-if="gate !== 'none'"
    :gate="gate"
    :invite-game-name="inviteGameName"
    :inert="serverDown"
    @play-offline="switchMode('offline')"
  />

  <GameLayout v-else :inert="serverDown">
    <NuxtPage :page-key="pageKey" />

    <template #left>
      <PlayersPanel />
    </template>

    <template #right>
      <DiceDrawer />
    </template>
  </GameLayout>
</template>
