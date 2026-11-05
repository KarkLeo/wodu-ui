<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose, DialogTitle, VisuallyHidden } from 'reka-ui'
import IconButton from './IconButton.vue'
import IconClose from './icons/IconClose.vue'
import { t } from '@/locales'

const props = withDefaults(defineProps<{
  title?: string
  maxWidth?: number
}>(), {
  maxWidth: 520,
})

const emit = defineEmits<{ (e: 'closeAutoFocus', event: Event): void }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="bs-overlay" />
      <DialogContent
        class="bs-content-wrap"
        :aria-describedby="undefined"
        @close-auto-focus="emit('closeAutoFocus', $event)"
        @click.self="open = false"
      >
        <div class="bottom-sheet" :style="{ maxWidth: `${props.maxWidth}px` }">
          <slot name="header">
            <div v-if="title" class="bs-head">
              <DialogTitle class="bs-title">{{ title }}</DialogTitle>
              <div class="bs-head-right">
                <slot name="head-right" />
                <DialogClose as-child>
                  <IconButton class="bs-close" :label="t('common.close')"><IconClose :size="12" /></IconButton>
                </DialogClose>
              </div>
            </div>
            <div v-else class="bs-head is-bare">
              <VisuallyHidden>
                <DialogTitle>{{ t('ui.bottomSheet.dialogTitle') }}</DialogTitle>
              </VisuallyHidden>
              <DialogClose as-child>
                <IconButton class="bs-close" :label="t('common.close')"><IconClose :size="12" /></IconButton>
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
/* Portal — unscoped styles (shared .bs-overlay/.bs-content-wrap/.bottom-sheet — in main.css) */
.bs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--vtt-border-subtle);
  flex-shrink: 0;
}
.bs-head.is-bare {
  justify-content: flex-end;
  padding: 10px 12px 0;
  border-bottom: 0;
}
.bs-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bs-title {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
}

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
  background: var(--vtt-base-a30);
  flex-shrink: 0;
}
</style>
