<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { findGameByCode, joinGame, loadGame } from '@/transport/games'
import { mode } from '@/transport/mode'
import { normalizeInviteCode } from '@/utils/inviteCode'
import type { Game } from '@/types/game'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const props = defineProps<{ code: string }>()

type JoinState = 'checking' | 'notFound' | 'member' | 'joining' | 'failed'

const log = createLogger('join')
const router = useRouter()
const games = useGamesStore()

const state = ref<JoinState>('checking')
const game = ref<Game | null>(null)

const gameName = computed(() => game.value?.name ?? '')

function isMember(gameId: string): boolean {
  const me = currentUser.value?.id
  return !!me && games.membersOf(gameId).some(m => m.user === me)
}

function statusOf(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
}

// A 400 is also what joining twice answers (another session may have joined meanwhile): only the
// membership itself tells a reset code from that.
async function joinedAfterAll(gameId: string): Promise<boolean> {
  try {
    await loadGame(gameId)
  } catch (err) {
    log.warn('membership re-check failed', { gameId, err })
    return false
  }
  return isMember(gameId)
}

async function run() {
  const code = normalizeInviteCode(props.code)
  if (!code) {
    state.value = 'notFound'
    return
  }
  state.value = 'checking'
  let found: Game | null
  try {
    found = await findGameByCode(code)
  } catch (err) {
    log.warn('invite lookup failed', { err })
    state.value = 'failed'
    return
  }
  if (!found) {
    state.value = 'notFound'
    return
  }
  game.value = found
  if (isMember(found.id)) {
    state.value = 'member'
    return
  }
  state.value = 'joining'
  try {
    await joinGame(found, code)
  } catch (err) {
    log.warn('join failed', { gameId: found.id, err })
    const status = statusOf(err)
    if (status === 400 && await joinedAfterAll(found.id)) {
      state.value = 'member'
      return
    }
    // A code reset between the lookup and the join answers 400 (404 for a game deleted meanwhile).
    // 401/403 is an expired session, not a bad invite: it gets the retry.
    state.value = status === 400 || status === 404 ? 'notFound' : 'failed'
    return
  }
  await router.replace({ name: 'game', params: { gameId: found.id } })
}

// Membership is known only once the online data has loaded. Offline data counts as loaded too, and
// the mode switches before this page unmounts on the way to /offline, so a switch must not start a lookup.
let started = false
watch(onlineDataReady, (ready) => {
  if (!ready || started || mode.value !== 'online') return
  started = true
  void run()
}, { immediate: true })

// The view stays mounted when only the code in the URL changes.
watch(() => props.code, () => {
  if (onlineDataReady.value && mode.value === 'online') void run()
})

function openTable() {
  if (game.value) void router.push({ name: 'game', params: { gameId: game.value.id } })
}

function goHome() {
  void router.push({ name: 'games' })
}
</script>

<template>
  <div class="content-wrap jv-screen">
    <section class="jv-card" :aria-busy="state === 'checking' || state === 'joining'">
      <template v-if="state === 'checking' || state === 'joining'">
        <p class="eyebrow">{{ t('games.invite.eyebrow') }}</p>
        <p class="jv-status" role="status">
          {{ state === 'joining' ? t('games.join.joining', { game: gameName }) : t('games.join.checking') }}
        </p>
      </template>

      <template v-else-if="state === 'notFound'">
        <p class="eyebrow">{{ t('games.invite.eyebrow') }}</p>
        <h2 class="jv-title">{{ t('games.invite.notFound') }}</h2>
        <p class="jv-body">{{ t('games.invite.notFoundHint') }}</p>
        <div class="jv-actions">
          <Button variant="primary" size="lg" @click="goHome">{{ t('games.join.home') }}</Button>
        </div>
      </template>

      <template v-else-if="state === 'member'">
        <p class="eyebrow">{{ t('games.invite.eyebrow') }}</p>
        <h2 class="jv-title">{{ t('games.join.memberTitle', { game: gameName }) }}</h2>
        <div class="jv-actions">
          <Button variant="hero" size="lg" @click="openTable">{{ t('games.join.openTable') }}</Button>
          <Button variant="ghost" size="lg" @click="goHome">{{ t('games.join.home') }}</Button>
        </div>
      </template>

      <template v-else>
        <p class="eyebrow">{{ t('games.invite.eyebrow') }}</p>
        <p class="jv-body" role="alert">{{ t('games.join.failed') }}</p>
        <div class="jv-actions">
          <Button variant="hero" size="lg" @click="run">{{ t('games.join.retry') }}</Button>
          <Button variant="ghost" size="lg" @click="goHome">{{ t('games.join.home') }}</Button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.jv-screen {
  --jv-w: min(420px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--jv-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--jv-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--jv-w));
  padding: 48px 16px;
}
.jv-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  background: var(--vtt-bg-surface);
  box-shadow: var(--shadow-3);
}
.jv-card .eyebrow { margin: 0; }
.jv-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.jv-body,
.jv-status {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.55;
  color: var(--vtt-text-secondary);
}
.jv-status { font-style: italic; color: var(--vtt-text-muted); }
.jv-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: var(--s-2);
}
.jv-actions > * { width: 100%; justify-content: center; }
</style>
