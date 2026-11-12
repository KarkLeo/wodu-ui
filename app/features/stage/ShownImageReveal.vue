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
  /** This opening was asked for from the card's button; otherwise the view opened by itself. */
  fromCard?: boolean
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

// Where the focus was before the view opened. Opened by itself (the master showed a picture), the view must not take the
// keys of someone typing in a sheet: no control gets the focus, the panel itself does, so a Space or an Enter does
// nothing. Opened from the card's own button, the close button takes it as usual. Who opened it is told by the source
// (`fromCard`), never by where the focus is: after a close the focus sits on the card's button, and the next picture
// shown must still not take the keys. Closing gives the focus back to that element wherever it is, when it is still
// there and can take it; otherwise to the card's picture button when the card is shown, otherwise it stays on the page.
// Nothing scrolls on the way: on a phone the tray would jump to the card.
let before: HTMLElement | null = null
function rememberFocus(event: Event) {
  const active = document.activeElement
  before = active instanceof HTMLElement && active !== document.body ? active : null
  if (props.fromCard) return
  event.preventDefault()
  ;(event.target as HTMLElement | null)?.focus({ preventScroll: true })
}
function returnFocus(event: Event) {
  event.preventDefault()
  const back = before
  before = null
  if (back?.isConnected) {
    back.focus({ preventScroll: true })
    // Hidden meanwhile (a closed popover, `display: none`): it could not take the focus.
    if (document.activeElement === back) return
  }
  const card = document.querySelector<HTMLElement>('[data-shown-image-open]')
  if (card && card.getClientRects().length > 0) card.focus({ preventScroll: true })
}
</script>

<template>
  <DialogRoot :open="visible" @update:open="open = $event">
    <DialogPortal>
      <DialogOverlay class="sir-veil" />
      <DialogContent
        v-if="image"
        :class="['sir-panel', { 'has-caption': !!image.caption }]"
        :aria-describedby="undefined"
        @open-auto-focus="rememberFocus"
        @close-auto-focus="returnFocus"
      >
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
/* Portalled to <body>: not scoped. Above the sheets (300 / 301), so an open sheet is dimmed too; below the tooltips (400). */
.sir-veil {
  position: fixed;
  inset: 0;
  z-index: 350;
  background: var(--vtt-black-a72);
}
.sir-panel {
  --sir-mx: max(var(--s-4), env(safe-area-inset-left), env(safe-area-inset-right));
  --sir-my: max(var(--s-4), env(safe-area-inset-top), env(safe-area-inset-bottom));
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 351;
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

/* A short landscape screen (a phone on its side): the close button and the caption go beside the picture, which then
   gets nearly the whole height. The side column is the close button alone without a caption. */
@media (max-height: 520px) and (orientation: landscape) {
  .sir-panel {
    --sir-my: max(var(--s-2), env(safe-area-inset-top), env(safe-area-inset-bottom));
    --sir-side: 28px;
    display: grid;
    grid-template: "stage head" auto "stage title" minmax(0, 1fr) / auto minmax(0, max-content);
    gap: var(--s-2) var(--s-3);
    padding: var(--s-2);
  }
  .sir-panel.has-caption { --sir-side: min(12rem, 30vw); }
  .sir-stage { grid-area: stage; }
  .sir-head { grid-area: head; }
  .sir-title {
    grid-area: title;
    max-width: var(--sir-side);
    max-height: calc(100dvh - 2 * var(--sir-my) - 2 * var(--s-2) - 2px - 28px - var(--s-2));
    font-size: 14px;
  }
  .sir-img {
    max-height: calc(100dvh - 2 * var(--sir-my) - 2 * var(--s-2) - 2px);
    max-width: calc(100vw - 2 * var(--sir-mx) - 2 * var(--s-2) - 2px - var(--s-3) - var(--sir-side));
  }
}

@media (prefers-reduced-motion: no-preference) {
  .sir-veil[data-state='open'],
  .sir-panel[data-state='open'] { animation: sir-fade 0.18s var(--ease); }
}
@keyframes sir-fade { from { opacity: 0; } }
</style>
