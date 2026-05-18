<script setup lang="ts">
import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { t } from '@/locales'

const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true })
const updating = ref(false)

async function apply() {
  updating.value = true
  await updateServiceWorker(true)
}

function dismiss() {
  needRefresh.value = false
}
</script>

<template>
  <div v-if="needRefresh" class="pwa-prompt" role="status">
    <div class="pwa-prompt__text">{{ t('pwa.updateAvailable') }}</div>
    <button
      type="button"
      class="pwa-prompt__action"
      :disabled="updating"
      @click="apply"
    >
      {{ updating ? t('pwa.updating') : t('pwa.update') }}
    </button>
    <button
      type="button"
      class="pwa-prompt__dismiss"
      :aria-label="t('common.close')"
      @click="dismiss"
    >
      ×
    </button>
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
  background: rgba(28, 22, 16, 0.96);
  border: 1px solid rgba(140, 106, 58, 0.55);
  border-radius: var(--r-md);
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--vtt-text-primary);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  max-width: 92vw;
}
.pwa-prompt__text {
  font-weight: 500;
}
.pwa-prompt__action {
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
.pwa-prompt__action:hover:not(:disabled) {
  background: rgba(140, 106, 58, 0.2);
}
.pwa-prompt__action:disabled {
  opacity: 0.6;
  cursor: progress;
}
.pwa-prompt__dismiss {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--vtt-text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.pwa-prompt__dismiss:hover {
  color: var(--vtt-text-primary);
}
</style>
