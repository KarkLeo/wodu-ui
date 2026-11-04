<script setup lang="ts">
import { ref } from 'vue'
import { applyUpdate, updateReady } from '@/pwa/updateState'
import { t } from '@/locales'
import IconButton from '@/components/ui/IconButton.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'

const updating = ref(false)

async function apply() {
  updating.value = true
  await applyUpdate()
}

function dismiss() {
  updateReady.value = false
}
</script>

<template>
  <div v-if="updateReady" class="pwa-prompt" role="status">
    <div class="pwa-prompt__text">{{ t('pwa.updateAvailable') }}</div>
    <button
      type="button"
      class="pwa-prompt__action"
      :disabled="updating"
      @click="apply"
    >
      {{ updating ? t('pwa.updating') : t('pwa.update') }}
    </button>
    <IconButton size="sm" :label="t('common.close')" @click="dismiss">
      <IconClose :size="12" />
    </IconButton>
  </div>
</template>

<style scoped>
.pwa-prompt {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vtt-surface-a96);
  border: 1px solid var(--vtt-gold-a55);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--vtt-text-primary);
  box-shadow: 0 6px 20px var(--vtt-black-a40);
  max-width: 92vw;
}
.pwa-prompt__text {
  font-weight: 500;
}
.pwa-prompt__action {
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--vtt-gold-a55);
  border-radius: var(--r-sm);
  color: var(--vtt-accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.pwa-prompt__action:hover:not(:disabled) {
  background: var(--vtt-gold-a20);
}
.pwa-prompt__action:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
