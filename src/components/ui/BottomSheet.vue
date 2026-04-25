<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose } from 'reka-ui'
import IconClose from './icons/IconClose.vue'

const props = withDefaults(defineProps<{
  title?: string
  maxWidth?: number
}>(), {
  maxWidth: 520,
})

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="bs-overlay" />
      <DialogContent class="bs-content-wrap">
        <div class="bottom-sheet" :style="{ maxWidth: `${props.maxWidth}px` }">
          <slot name="header">
            <div v-if="title" class="bs-head">
              <span class="bs-title">{{ title }}</span>
              <DialogClose class="bs-close" aria-label="Закрыть">
                <IconClose />
              </DialogClose>
            </div>
          </slot>
          <div class="bs-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="bs-foot">
            <slot name="footer" />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
/* Portal — нескоупленные стили (общие .bs-overlay/.bs-content-wrap/.bottom-sheet — в main.css) */
.bs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--vtt-border-subtle);
  flex-shrink: 0;
}
.bs-title {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
}
.bs-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  padding: 0;
}
.bs-close:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}
.bs-close svg { width: 12px; height: 12px; }

.bs-body {
  padding: 14px 18px 18px;
  max-height: 560px;
  overflow-y: auto;
}
.bs-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid var(--vtt-border-subtle);
  background: rgba(14, 11, 8, 0.3);
  flex-shrink: 0;
}
</style>
