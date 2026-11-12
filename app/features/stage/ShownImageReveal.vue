<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose, DialogTitle } from 'reka-ui'
import IconButton from '@/components/ui/IconButton.vue'
import IconClose from '@/components/ui/icons/IconClose.vue'
import StateNote from '@/components/ui/StateNote.vue'
import { t } from '@/locales'

const props = defineProps<{
  /** The shown image, or null when there is none. */
  image: { url: string; caption: string | null } | null
}>()
const open = defineModel<boolean>('open', { required: true })

const loaded = ref(false)
const failed = ref(false)
function reset() {
  loaded.value = false
  failed.value = false
}
// A new picture, or the view opening again, starts clean: one failed attempt is not remembered.
watch(() => props.image?.url, reset)
watch(open, (now) => { if (now) reset() })

function onLoad() {
  loaded.value = true
  failed.value = false
}

const visible = computed(() => open.value && props.image !== null)

// Where the focus was before the view opened, so closing it returns there when that is an element of a sheet that is
// still open (the reveal can open above one); otherwise to the card's picture button, otherwise to the page. The card
// is focused without scrolling: on a phone the tray would otherwise jump from the sheet the person was on to the card.
let before: HTMLElement | null = null
function rememberFocus() {
  before = document.activeElement instanceof HTMLElement ? document.activeElement : null
}
function returnFocus(event: Event) {
  event.preventDefault()
  const inOpenDialog = before?.isConnected && before.closest('[role="dialog"]')
  if (before && inOpenDialog) before.focus()
  else document.querySelector<HTMLElement>('[data-shown-image-open]')?.focus({ preventScroll: true })
  before = null
}
</script>

<template>
  <DialogRoot :open="visible" @update:open="open = $event">
    <DialogPortal>
      <DialogOverlay class="sir-veil" />
      <DialogContent v-if="image" class="sir-panel" :aria-describedby="undefined" @open-auto-focus="rememberFocus" @close-auto-focus="returnFocus">
        <div class="sir-head">
          <DialogClose as-child>
            <IconButton class="sir-close" :label="t('stage.shown.close')"><IconClose :size="14" /></IconButton>
          </DialogClose>
        </div>
        <div class="sir-stage">
          <StateNote v-if="failed" class="sir-note" size="sm" compact>{{ t('stage.shown.failed') }}</StateNote>
          <StateNote v-else-if="!loaded" class="sir-note" size="sm" compact>{{ t('stage.shown.loading') }}</StateNote>
          <img
            :key="image.url"
            :class="['sir-img', { 'is-pending': !loaded || failed }]"
            :src="image.url"
            alt=""
            @load="onLoad"
            @error="failed = true"
          >
        </div>
        <DialogTitle as="p" :class="['sir-title', { 'is-generic': !image.caption }]">{{ image.caption || t('stage.shown.generic') }}</DialogTitle>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* Portalled to <body>: not scoped. */
.sir-veil {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: var(--vtt-black-a72);
}
.sir-panel {
  --sir-mx: max(var(--s-4), env(safe-area-inset-left), env(safe-area-inset-right));
  --sir-my: max(var(--s-4), env(safe-area-inset-top), env(safe-area-inset-bottom));
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 301;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  box-sizing: border-box;
  width: max-content;
  min-width: min(320px, calc(100vw - 2 * var(--sir-mx)));
  max-width: calc(100vw - 2 * var(--sir-mx));
  max-height: calc(100dvh - 2 * var(--sir-my));
  padding: var(--s-3);
  background: var(--vtt-bg-elevated);
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-3);
}
.sir-panel:focus { outline: none; }
.sir-head { display: flex; justify-content: flex-end; }
.sir-title {
  margin: 0;
  max-height: 5.6em;
  overflow-y: auto;
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.4;
  color: var(--vtt-text-primary);
  overflow-wrap: anywhere;
}
.sir-title.is-generic {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.sir-stage { display: flex; align-items: center; justify-content: center; min-width: 0; }
/* Natural size, never upscaled, never cropped: the box keeps the picture's own ratio. */
.sir-img {
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100vw - 2 * var(--sir-mx) - 2 * var(--s-3) - 2px);
  max-height: calc(100dvh - 2 * var(--sir-my) - 208px);
  object-fit: contain;
}
.sir-img.is-pending { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.sir-note { margin: 0; }

@media (prefers-reduced-motion: no-preference) {
  .sir-veil[data-state='open'],
  .sir-panel[data-state='open'] { animation: sir-fade 0.18s var(--ease); }
}
@keyframes sir-fade { from { opacity: 0; } }
</style>
