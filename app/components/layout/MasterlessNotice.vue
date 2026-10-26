<script setup lang="ts">
import { ref } from 'vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import Button from '@/components/ui/Button.vue'
import { useGameAction } from '@/composables/useGameAction'
import { useToastsStore } from '@/stores/toasts'
import { claimMaster, MasterTakenError } from '@/transport/games'
import type { Game } from '@/types/game'
import { t } from '@/locales'
import './game.css'

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
  <section class="ml-notice" :aria-label="t('games.table.noMaster')">
    <p class="ml-title">{{ t('games.table.noMaster') }}</p>
    <p class="ml-hint">{{ t('games.table.noMasterHint') }}</p>
    <Button variant="primary" size="sm" class="ml-claim" @click="confirmOpen = true">{{ t('games.table.claim') }}</Button>
  </section>

  <ConfirmSheet v-model:open="confirmOpen" :title="t('games.claim.title')">
    <p>{{ t('games.claim.body') }}</p>
    <template #actions>
      <Button variant="hero" :disabled="busy" @click="confirmClaim">{{ t('games.claim.confirm') }}</Button>
      <Button variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</Button>
    </template>
  </ConfirmSheet>
</template>

<style scoped>
.ml-notice {
  margin: 0 var(--s-3) var(--s-2);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  background: rgba(212, 168, 87, 0.06);
}
.ml-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-accent-soft);
}
.ml-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  line-height: 1.4;
  color: var(--vtt-text-muted);
}
.ml-claim { align-self: flex-start; }
</style>
