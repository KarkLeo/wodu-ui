<script setup lang="ts">
import { ref } from 'vue'
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import Button from '@/components/ui/Button.vue'
import { t } from '@/locales'

const props = withDefaults(defineProps<{
  attempt: number
  noInternet: boolean
  probing?: boolean
}>(), {
  probing: false,
})

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'playOffline'): void
}>()

const retryButton = ref<InstanceType<typeof Button> | null>(null)

function focusRetry(event: Event) {
  event.preventDefault()
  ;(retryButton.value?.$el as HTMLElement | undefined)?.focus()
}

// aria-disabled rather than disabled: a disabled button drops keyboard focus out of the dialog.
function retry() {
  if (!props.probing) emit('retry')
}
</script>

<!--
  A Reka dialog rather than a plain fixed layer: an open sheet (also a Reka dialog, portalled outside
  the inert GameLayout) disables pointer events on <body> and traps focus. Only a dialog stacked on
  top of it through Reka's layer stack gets pointer events and focus back.
-->
<template>
  <AlertDialogRoot :open="true">
    <AlertDialogPortal>
      <AlertDialogOverlay class="sdo-veil" />
      <AlertDialogContent
        class="sdo-card"
        @escape-key-down.prevent
        @open-auto-focus="focusRetry"
      >
        <div class="sdo-head">
          <span class="sdo-dot" aria-hidden="true" />
          <AlertDialogTitle as="span" class="sdo-title">{{ t('serverDown.title') }}</AlertDialogTitle>
        </div>
        <AlertDialogDescription as="p" class="sdo-body">
          {{ t(noInternet ? 'serverDown.bodyNoInternet' : 'serverDown.body') }}
        </AlertDialogDescription>
        <p class="sdo-status">{{ t('serverDown.reconnecting', { attempt }) }}</p>
        <div class="sdo-actions">
          <Button
            ref="retryButton"
            variant="primary"
            size="sm"
            class="sdo-btn"
            :aria-disabled="probing ? 'true' : undefined"
            @click="retry"
          >{{ t('serverDown.retry') }}</Button>
          <Button
            variant="hero"
            size="sm"
            class="sdo-btn"
            @click="emit('playOffline')"
          >{{ t('serverDown.playOffline') }}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
/* Above the dice overlay (500), below toasts (1000) so their messages stay readable. */
.sdo-veil {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(7, 5, 10, 0.72);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

.sdo-card {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 901;
  transform: translate(-50%, -50%);
  width: calc(100% - 2 * var(--s-4));
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  background: rgba(26, 21, 16, 0.96);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
}

.sdo-head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.sdo-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--r-pill);
  background: var(--vtt-danger-bright);
  flex-shrink: 0;
  animation: tab-dot-pulse 1.4s ease-in-out infinite;
}
.sdo-title {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-accent-soft);
}

.sdo-body {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.4;
  color: var(--vtt-text-primary);
}

.sdo-status {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}

.sdo-actions {
  display: flex;
  gap: var(--s-2);
  margin-top: var(--s-1);
}
.sdo-btn {
  flex: 1;
  justify-content: center;
}
.sdo-btn[aria-disabled='true'] {
  opacity: 0.5;
  cursor: progress;
}
</style>
