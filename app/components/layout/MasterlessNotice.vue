<script setup lang="ts">
import { ref } from 'vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useToastsStore } from '@/stores/toasts'
import { claimMaster, MasterTakenError } from '@/transport/games'
import type { Game } from '@/types/game'
import { t } from '@/locales'

const props = defineProps<{ game: Game }>()

const { busy, run } = useGameAction()
const confirmOpen = ref(false)

async function confirmClaim() {
  let taken = false
  await run('claimMaster', t('games.claim.failed'), async () => {
    try {
      await claimMaster(props.game.id)
    } catch (err) {
      // Not a failed write: the other member's claim won, and the game now shows them as master.
      if (!(err instanceof MasterTakenError)) throw err
      taken = true
    }
  })
  if (taken) useToastsStore().push(t('games.claim.taken'), 'info')
  confirmOpen.value = false
}
</script>

<template>
  <AlertBanner
    as="section"
    tone="accent"
    stacked
    class="ml-notice"
    :announce="false"
    :aria-label="t('games.table.noMaster')"
    :title="t('games.table.noMaster')"
  >
    {{ t('games.table.noMasterHint') }}
    <template #action>
      <Button variant="primary" size="sm" @click="confirmOpen = true">{{ t('games.table.claim') }}</Button>
    </template>
  </AlertBanner>

  <ConfirmSheet v-model:open="confirmOpen" :title="t('games.claim.title')">
    <p>{{ t('games.claim.body') }}</p>
    <template #actions>
      <Button variant="hero" :disabled="busy" @click="confirmClaim">{{ t('games.claim.confirm') }}</Button>
      <Button variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>

<style scoped>
.ml-notice { margin: 0 var(--s-3) var(--s-2); }
</style>
