<script setup lang="ts">
import { useToastsStore } from '@/stores/toasts'
import { storeToRefs } from 'pinia'

const toasts = useToastsStore()
const { items } = storeToRefs(toasts)
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <button
      v-for="t in items"
      :key="t.id"
      type="button"
      :class="['toast', `toast--${t.kind}`]"
      @click="toasts.dismiss(t.id)"
    >
      {{ t.text }}
    </button>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
  max-width: min(92vw, 480px);
}
.toast {
  pointer-events: all;
  text-align: left;
  font-family: var(--font-serif);
  font-size: 14px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--vtt-gold-a40);
  background: var(--vtt-toast-a95);
  color: var(--vtt-text-primary);
  cursor: pointer;
  box-shadow: 0 6px 20px var(--vtt-black-a40);
  animation: toast-in 200ms ease-out;
}
.toast--error {
  border-color: var(--vtt-toast-error-border);
  color: var(--vtt-toast-error-text);
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
