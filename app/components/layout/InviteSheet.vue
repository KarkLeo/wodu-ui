<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { currentUser } from '@/transport/auth'
import { resetInviteCode } from '@/transport/games'
import type { Game } from '@/types/game'
import { formatInviteCode, inviteLink } from '@/utils/inviteCode'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import './game.css'

const props = defineProps<{ game: Game }>()
const open = defineModel<boolean>('open', { required: true })

const { busy, run } = useGameAction()

const master = computed(() => isMaster(props.game, currentUser.value?.id ?? null))
const code = computed(() => formatInviteCode(props.game.inviteCode))
const link = computed(() => inviteLink(window.location.origin, props.game.inviteCode))

const status = ref('')
const resetOpen = ref(false)

watch(open, (isOpen) => {
  if (isOpen) status.value = ''
})
watch(() => props.game.inviteCode, () => {
  status.value = ''
})

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    status.value = t('games.invite.copied')
  } catch {
    status.value = t('games.invite.copyFailed')
  }
}

async function confirmReset() {
  const ok = await run('resetInviteCode', t('games.invite.resetFailed'), () => resetInviteCode(props.game.id))
  if (ok) resetOpen.value = false
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('games.invite.title')" :max-width="420">
    <div class="gs-stack">
      <p class="gs-hint">{{ t('games.invite.hint') }}</p>
      <div class="gs-field">
        <span class="gs-label">{{ t('games.invite.code') }}</span>
        <code class="gs-value is-code" data-testid="invite-code">{{ code }}</code>
      </div>
      <div class="gs-field">
        <span class="gs-label">{{ t('games.invite.link') }}</span>
        <code class="gs-value is-link" data-testid="invite-link">{{ link }}</code>
      </div>
      <div class="gs-actions">
        <Button variant="primary" size="sm" @click="copy(link)">{{ t('games.invite.copyLink') }}</Button>
        <Button variant="ghost" size="sm" @click="copy(code)">{{ t('games.invite.copyCode') }}</Button>
      </div>
      <p class="gs-status" role="status">{{ status }}</p>
      <Button v-if="master" variant="danger-ghost" size="sm" @click="resetOpen = true">{{ t('games.invite.reset') }}</Button>
    </div>
  </BottomSheet>

  <ConfirmSheet v-model:open="resetOpen" :title="t('games.invite.resetTitle')">
    <p>{{ t('games.invite.resetBody') }}</p>
    <template #actions>
      <Button variant="hero" :disabled="busy" @click="confirmReset">{{ t('games.invite.resetConfirm') }}</Button>
      <Button variant="ghost" @click="resetOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>
