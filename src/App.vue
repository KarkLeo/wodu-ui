<script setup lang="ts">
import DiceOverlay from '@/components/DiceOverlay.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import ToastHost from '@/components/ToastHost.vue'
import GameLayout from '@/components/layout/GameLayout.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import { bootstrap, bootstrapStatus } from '@/transport/bootstrap'
import { t } from '@/locales'
</script>

<template>
  <DiceOverlay />
  <ToastHost />

  <div v-if="bootstrapStatus === 'failed'" class="bootstrap-banner" role="alert">
    <div class="bootstrap-banner__title">{{ t('bootstrap.failedTitle') }}</div>
    <div class="bootstrap-banner__hint">{{ t('bootstrap.failedHint') }}</div>
    <button type="button" class="bootstrap-banner__retry" @click="bootstrap()">
      {{ t('bootstrap.retry') }}
    </button>
  </div>

  <GameLayout>
    <RouterView />

    <template #left>
      <PlayersPanel />
    </template>

    <template #right>
      <DiceDrawer />
    </template>
  </GameLayout>
</template>

<style scoped>
.bootstrap-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(28, 22, 16, 0.96);
  border: 1px solid rgba(180, 70, 60, 0.55);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 13px;
  color: #f3c8c2;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  max-width: 92vw;
}
.bootstrap-banner__title { font-weight: 600; }
.bootstrap-banner__hint {
  font-style: italic;
  color: var(--vtt-text-muted);
  font-size: 12px;
}
.bootstrap-banner__retry {
  margin-left: auto;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid rgba(140, 106, 58, 0.55);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.bootstrap-banner__retry:hover { background: rgba(140, 106, 58, 0.2); }
</style>
